import { pool } from './connection.js';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running database migrations with indexes...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        property_address TEXT,
        property_type VARCHAR(100),
        client_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'in_progress',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON inspections(user_id);
    `);
    console.log('✅ Inspections table + index ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS findings (
        id SERIAL PRIMARY KEY,
        inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
        image_url TEXT,
        image_data TEXT,
        image_mime_type VARCHAR(50),
        inspector_comment TEXT,
        ai_issue VARCHAR(255),
        ai_category VARCHAR(100),
        ai_severity VARCHAR(50),
        ai_description TEXT,
        ai_recommendation TEXT,
        ai_confidence NUMERIC(5,2),
        ai_model_used VARCHAR(100),
        location_in_property VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_findings_inspection_id ON findings(inspection_id);
      CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(ai_severity);
      ALTER TABLE findings ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    console.log('✅ Findings table + indexes ready');

    console.log('🎉 All migrations and database optimizations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
