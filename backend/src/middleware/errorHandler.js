import { config } from '../config/index.js';

export function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err.stack || err.message);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File size exceeds the limit of ${config.upload.maxSizeMb}MB.`,
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
  }

  // Safe error message to avoid internal database/server leakage
  const statusCode = err.statusCode || 500;
  const isProd = config.nodeEnv === 'production';

  res.status(statusCode).json({
    error: isProd && statusCode === 500 ? 'An unexpected internal error occurred.' : (err.message || 'Server error'),
    code: err.code || 'INTERNAL_ERROR'
  });
}
