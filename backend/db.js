const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.DATABASE_URL ? true : false;
let db;

if (isProduction) {
  // PostgreSQL configuration for Render
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('Using PostgreSQL Database');
} else {
  // SQLite configuration for Local
  const DB_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const sqlite = new Database(path.join(DB_DIR, 'invoices.db'));
  sqlite.pragma('journal_mode = WAL');

  // Mock unified interface for SQLite
  db = {
    query: async (text, params) => {
      // Convert $1, $2 to ? for SQLite if needed, but we'll stick to ? globally for simplicity in our unified interface
      const stmt = sqlite.prepare(text);
      if (text.trim().toLowerCase().startsWith('select')) {
        return { rows: stmt.all(...(params || [])) };
      } else {
        const info = stmt.run(...(params || []));
        return { rows: [], rowCount: info.changes };
      }
    },
    // Shorthands for convenience
    get: async (text, params) => {
      const stmt = sqlite.prepare(text);
      return stmt.get(...(params || []));
    },
    all: async (text, params) => {
      const stmt = sqlite.prepare(text);
      return stmt.all(...(params || []));
    },
    run: async (text, params) => {
      const stmt = sqlite.prepare(text);
      return stmt.run(...(params || []));
    },
    exec: (text) => sqlite.exec(text)
  };
  console.log('Using SQLite Database');
}

// Unified interface for PostgreSQL
if (isProduction) {
  const originalQuery = db.query.bind(db);
  db.query = async (text, params) => {
    // Convert ? placeholders to $n for PostgreSQL
    let index = 1;
    const pgText = text.replace(/\?/g, () => `$${index++}`);
    return originalQuery(pgText, params);
  };

  db.get = async (text, params) => {
    const result = await db.query(text, params);
    return result.rows[0];
  };

  db.all = async (text, params) => {
    const result = await db.query(text, params);
    return result.rows;
  };

  db.run = async (text, params) => {
    return db.query(text, params);
  };

  db.exec = async (text) => {
    return db.query(text);
  };
}

// Initialization Logic
const initializeDB = async () => {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      vendor_name TEXT,
      invoice_number TEXT,
      invoice_date TEXT,
      due_date TEXT,
      subtotal NUMERIC,
      tax NUMERIC,
      total_amount NUMERIC,
      currency TEXT DEFAULT 'USD',
      file_path TEXT,
      file_name TEXT,
      ocr_raw_text TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id SERIAL PRIMARY KEY,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT,
      quantity NUMERIC,
      unit_price NUMERIC,
      amount NUMERIC
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      vendor_name TEXT,
      expected_amount NUMERIC,
      due_date TEXT,
      reference_number TEXT,
      status TEXT DEFAULT 'unpaid',
      register_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reconciliation_results (
      id TEXT PRIMARY KEY,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
      record_id TEXT,
      match_status TEXT,
      discrepancy NUMERIC,
      flag_reason TEXT,
      confidence_score NUMERIC,
      session_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reconciliation_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      register_file_name TEXT,
      total_invoices INTEGER DEFAULT 0,
      matched INTEGER DEFAULT 0,
      mismatched INTEGER DEFAULT 0,
      missing INTEGER DEFAULT 0,
      duplicate INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    // Note: Serial and TIMESTAMP syntax works for PG. For SQLite, we adjusted the schema slightly for compatibility.
    // better-sqlite3 handles standard SQL well, but SERIAL/TIMESTAMP might need care.
    // Actually, SQLITE doesn't support SERIAL. Let's make it more compatible.

    let compatSchema = schema;
    if (!isProduction) {
      compatSchema = schema
        .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, "TEXT DEFAULT (datetime('now'))")
        .replace(/NUMERIC/g, 'REAL');
    }

    await db.exec(compatSchema);
    console.log('Database Schema Initialized');
  } catch (err) {
    console.error('Database Initialization Failed:', err);
  }
};

initializeDB();

module.exports = db;
