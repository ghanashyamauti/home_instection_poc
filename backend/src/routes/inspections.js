import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db/connection.js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { aiAnalysisLimiter } from '../middleware/rateLimiter.js';
import { validateInspectionInput } from '../middleware/validation.js';
import { analyzeImage } from '../services/aiService.js';

const router = express.Router();

// Ensure upload directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

// Allowed image formats
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/jpg'
]);

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSizeMb * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file format. Allowed types: JPEG, PNG, WEBP. Received: ${file.mimetype}`), false);
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// 1. Create new inspection
router.post('/', validateInspectionInput, async (req, res, next) => {
  try {
    const { title, propertyAddress, propertyType, clientName } = req.body;

    const result = await pool.query(
      `INSERT INTO inspections (user_id, title, property_address, property_type, client_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, title, propertyAddress || null, propertyType || null, clientName || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// 2. Get all inspections for authenticated user
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT i.*, COUNT(f.id)::int as finding_count
       FROM inspections i
       LEFT JOIN findings f ON f.inspection_id = i.id
       WHERE i.user_id = $1
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// 3. Get single inspection with findings
router.get('/:id', async (req, res, next) => {
  try {
    const inspection = await pool.query(
      'SELECT * FROM inspections WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (inspection.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or unauthorized.', code: 'NOT_FOUND' });
    }

    const findings = await pool.query(
      `SELECT id, inspection_id, image_url, image_data, image_mime_type, 
              inspector_comment, ai_issue, ai_category, ai_severity, 
              ai_description, ai_recommendation, ai_confidence, ai_model_used, 
              location_in_property, created_at
       FROM findings 
       WHERE inspection_id = $1 
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({
      ...inspection.rows[0],
      findings: findings.rows
    });
  } catch (err) {
    next(err);
  }
});

// Quick 1-click scan without creating manual project first
router.post('/scan-quick', aiAnalysisLimiter, upload.single('image'), async (req, res, next) => {
  try {
    const { comment, location, title } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'An image file is required.', code: 'MISSING_FILE' });
    }

    // Find or create default quick inspection for user
    let inspectionId;
    const defaultInsp = await pool.query(
      `SELECT id FROM inspections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    if (defaultInsp.rows.length > 0) {
      inspectionId = defaultInsp.rows[0].id;
    } else {
      const newInsp = await pool.query(
        `INSERT INTO inspections (user_id, title, property_type)
         VALUES ($1, $2, 'residential')
         RETURNING id`,
        [req.userId, title || 'On-Site Quick Inspections']
      );
      inspectionId = newInsp.rows[0].id;
    }

    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Save image to disk
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const filePath = path.join(config.upload.dir, filename);
    await fs.promises.writeFile(filePath, req.file.buffer);
    const imageUrl = `/uploads/${filename}`;

    // Run AI analysis
    const analysis = await analyzeImage(base64Image, mimeType, comment);

    // Save to database
    const result = await pool.query(
      `INSERT INTO findings (
         inspection_id, image_url, image_data, image_mime_type, inspector_comment, 
         ai_issue, ai_category, ai_severity, ai_description, ai_recommendation, 
         ai_confidence, ai_model_used, location_in_property
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        inspectionId,
        imageUrl,
        base64Image,
        mimeType,
        comment?.trim() || null,
        analysis.issue,
        analysis.category,
        analysis.severity,
        analysis.description,
        analysis.recommendation,
        analysis.confidence,
        analysis.model_used,
        location?.trim() || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Multi-photo batch scan endpoint (processes up to 10 photos in one inspection session)
router.post('/scan-batch', aiAnalysisLimiter, upload.array('images', 10), async (req, res, next) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one image file is required for batch scan.', code: 'MISSING_FILES' });
    }

    const { comment, location, title } = req.body;
    let itemLocations = [];
    let itemComments = [];
    try {
      if (req.body.itemLocations) {
        itemLocations = typeof req.body.itemLocations === 'string' ? JSON.parse(req.body.itemLocations) : req.body.itemLocations;
      }
      if (req.body.itemComments) {
        itemComments = typeof req.body.itemComments === 'string' ? JSON.parse(req.body.itemComments) : req.body.itemComments;
      }
    } catch (_) {}

    // Create a new batch inspection container
    const inspTitle = title || `Property Audit (${files.length} Photo${files.length > 1 ? 's' : ''}) - ${new Date().toLocaleDateString()}`;
    const newInsp = await pool.query(
      `INSERT INTO inspections (user_id, title, property_address, property_type)
       VALUES ($1, $2, $3, 'residential')
       RETURNING *`,
      [req.userId, inspTitle, location?.trim() || 'On-Site Property Inspection']
    );
    const inspection = newInsp.rows[0];

    const findings = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileComment = (Array.isArray(itemComments) && itemComments[i]) ? itemComments[i] : (comment?.trim() || '');
      const fileLocation = (Array.isArray(itemLocations) && itemLocations[i]) ? itemLocations[i] : (location?.trim() || '');

      const base64Image = file.buffer.toString('base64');
      const mimeType = file.mimetype;

      // Persist to disk
      const ext = path.extname(file.originalname) || '.jpg';
      const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
      const filePath = path.join(config.upload.dir, filename);
      await fs.promises.writeFile(filePath, file.buffer);
      const imageUrl = `/uploads/${filename}`;

      // Run AI vision analysis
      const analysis = await analyzeImage(base64Image, mimeType, fileComment);

      // Save finding to database
      const findingRes = await pool.query(
        `INSERT INTO findings (
           inspection_id, image_url, image_data, image_mime_type, inspector_comment, 
           ai_issue, ai_category, ai_severity, ai_description, ai_recommendation, 
           ai_confidence, ai_model_used, location_in_property
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          inspection.id,
          imageUrl,
          base64Image,
          mimeType,
          fileComment?.trim() || null,
          analysis.issue,
          analysis.category,
          analysis.severity,
          analysis.description,
          analysis.recommendation,
          analysis.confidence,
          analysis.model_used,
          fileLocation?.trim() || null
        ]
      );

      findings.push(findingRes.rows[0]);
    }

    res.status(201).json({
      inspection,
      findings
    });
  } catch (err) {
    next(err);
  }
});

// Get all recent findings across all inspections for Tab 2 History
router.get('/findings/recent', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT f.*, i.title as inspection_title, i.property_address
       FROM findings f
       JOIN inspections i ON i.id = f.inspection_id
       WHERE i.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT 50`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// 4. Add finding to inspection (upload image + AI vision analysis)
router.post('/:id/findings', aiAnalysisLimiter, upload.single('image'), async (req, res, next) => {
  try {
    const inspectionId = req.params.id;
    const { comment, location } = req.body;

    // Verify inspection ownership
    const inspection = await pool.query(
      'SELECT id FROM inspections WHERE id = $1 AND user_id = $2',
      [inspectionId, req.userId]
    );

    if (inspection.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or unauthorized.', code: 'NOT_FOUND' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'An image file is required.', code: 'MISSING_FILE' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Persist file securely to disk with unique random name
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const filePath = path.join(config.upload.dir, filename);
    await fs.promises.writeFile(filePath, req.file.buffer);
    const imageUrl = `/uploads/${filename}`;

    // Perform AI analysis
    const analysis = await analyzeImage(base64Image, mimeType, comment);

    // Save finding in database
    const result = await pool.query(
      `INSERT INTO findings (
         inspection_id, image_url, image_data, image_mime_type, inspector_comment, 
         ai_issue, ai_category, ai_severity, ai_description, ai_recommendation, 
         ai_confidence, ai_model_used, location_in_property
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        inspectionId,
        imageUrl,
        base64Image,
        mimeType,
        comment?.trim() || null,
        analysis.issue,
        analysis.category,
        analysis.severity,
        analysis.description,
        analysis.recommendation,
        analysis.confidence,
        analysis.model_used,
        location?.trim() || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// 5. Delete finding
router.delete('/:inspectionId/findings/:findingId', async (req, res, next) => {
  try {
    const { inspectionId, findingId } = req.params;

    // Verify ownership
    const inspection = await pool.query(
      'SELECT id FROM inspections WHERE id = $1 AND user_id = $2',
      [inspectionId, req.userId]
    );

    if (inspection.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or unauthorized.', code: 'NOT_FOUND' });
    }

    const result = await pool.query(
      'DELETE FROM findings WHERE id = $1 AND inspection_id = $2 RETURNING id',
      [findingId, inspectionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Finding not found.', code: 'NOT_FOUND' });
    }

    res.json({ message: 'Finding deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// 6. Update inspection status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['in_progress', 'completed', 'reviewed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    const result = await pool.query(
      `UPDATE inspections 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [status, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or unauthorized.', code: 'NOT_FOUND' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// 7. Delete inspection
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM inspections WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inspection not found or unauthorized.', code: 'NOT_FOUND' });
    }

    res.json({ message: 'Inspection deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
