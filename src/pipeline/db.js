/**
 * db.js — Postgres connection pool for ingestion history.
 * Uses DATABASE_URL env var. Gracefully no-ops if not configured.
 */

import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export function isDbConfigured() {
  return !!process.env.DATABASE_URL;
}
