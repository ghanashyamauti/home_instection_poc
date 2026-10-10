import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key, defaultValue = undefined) {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`[Config Error] Missing required environment variable: ${key}`);
  }
  return value;
}

const aiModelsChain = (process.env.AI_MODELS_FALLBACK_CHAIN || 'google/gemma-4-31b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,dots-studio/dots-3-note-preview:free,google/gemma-4-26b-a4b-it:free')
  .split(',')
  .map(m => m.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  db: {
    url: requireEnv('DATABASE_URL'),
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  },

  ai: {
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions',
    models: aiModelsChain
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },

  app: {
    clientUrl: process.env.APP_CLIENT_URL || 'http://localhost:5173'
  },

  upload: {
    maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    dir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || './uploads')
  }
};
