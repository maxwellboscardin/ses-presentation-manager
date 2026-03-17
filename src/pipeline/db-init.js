/**
 * db-init.js — Auto-creates tables on first connect.
 */

import { getPool, isDbConfigured } from './db.js';

export async function initDb() {
  if (!isDbConfigured()) {
    console.log('[db] DATABASE_URL not set — skipping database init');
    return;
  }

  const pool = getPool();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingestion_inputs (
        id SERIAL PRIMARY KEY,
        collection TEXT,
        data_point_id TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        input_type TEXT NOT NULL,
        raw_input TEXT,
        extracted_value JSONB,
        model_used TEXT,
        confidence REAL,
        reasoning TEXT,
        escalation_path JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('[db] Tables initialized');
  } catch (err) {
    console.error('[db] Failed to initialize tables:', err.message);
  }
}
