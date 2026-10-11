import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './src/config/index.js';
import authRoutes from './src/routes/auth.js';
import inspectionRoutes from './src/routes/inspections.js';
import { generalApiLimiter } from './src/middleware/rateLimiter.js';
import { errorHandler } from './src/middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Deployment & Mobile-Resilient CORS
const allowedOrigins = config.cors.origin.split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (native mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Wildcard allowed
    if (allowedOrigins.includes('*')) return callback(null, true);

    // Explicit origin match
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Mobile apps / WebViews / Local testing
    if (origin.startsWith('capacitor://') || origin.startsWith('ionic://') || origin.startsWith('http://localhost')) {
      return callback(null, true);
    }

    // In non-production, permit all origins
    if (config.nodeEnv !== 'production') {
      return callback(null, true);
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Performance & Parsing
app.use(compression());
app.use(express.json({ limit: `${config.upload.maxSizeMb + 2}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${config.upload.maxSizeMb + 2}mb` }));

// Serve uploaded inspection images securely
app.use('/uploads', express.static(config.upload.dir));

// General API rate limiting
app.use('/api', generalApiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/inspections', inspectionRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

// Centralized Error Handling
app.use(errorHandler);

// Start Server (only when executed directly, bypassed when imported by Vercel serverless)
if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`🏛️ Mentis Backend running on port ${config.port}`);
    console.log(`📡 Environment: ${config.nodeEnv}`);
    console.log(`🔒 Allowed CORS Origins: ${config.cors.origin}`);
  });
}

export default app;

