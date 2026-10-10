import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.url,
  ssl: {
    rejectUnauthorized: config.db.sslRejectUnauthorized
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Resilient pool error handling (prevents unhandled crash on dropped connection)
pool.on('error', (err) => {
  console.error('[Database Pool Error]: Unexpected error on idle client', err.message);
});
