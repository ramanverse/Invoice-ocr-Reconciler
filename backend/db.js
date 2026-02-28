const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'invoices.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    vendor_name TEXT,
    invoice_number TEXT,
    invoice_date TEXT,
    due_date TEXT,
    subtotal REAL,
    tax REAL,
    total_amount REAL,
    currency TEXT DEFAULT 'USD',
    file_path TEXT,
    file_name TEXT,
    ocr_raw_text TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT,
    description TEXT,
    quantity REAL,
    unit_price REAL,
    amount REAL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payment_records (
    id TEXT PRIMARY KEY,
    vendor_name TEXT,
    expected_amount REAL,
    due_date TEXT,
    reference_number TEXT,
    status TEXT DEFAULT 'unpaid',
    register_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reconciliation_results (
    id TEXT PRIMARY KEY,
    invoice_id TEXT,
    record_id TEXT,
    match_status TEXT,
    discrepancy REAL,
    flag_reason TEXT,
    confidence_score REAL,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reconciliation_sessions (
    id TEXT PRIMARY KEY,
    register_file_name TEXT,
    total_invoices INTEGER DEFAULT 0,
    matched INTEGER DEFAULT 0,
    mismatched INTEGER DEFAULT 0,
    missing INTEGER DEFAULT 0,
    duplicate INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
