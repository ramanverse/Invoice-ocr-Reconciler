const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Tesseract = require('tesseract.js');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const db = require('./db');
const { parseInvoice } = require('./invoiceParser');
const { reconcile } = require('./reconciliationEngine');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const REGISTER_DIR = path.join(__dirname, 'registers');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(REGISTER_DIR)) fs.mkdirSync(REGISTER_DIR, { recursive: true });

// Multer configuration
const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});
const registerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REGISTER_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const uploadInvoice = multer({
  storage: invoiceStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});

const uploadRegister = multer({
  storage: registerStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.json'].includes(ext)) cb(null, true);
    else cb(new Error('Only CSV and JSON files are allowed'));
  },
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function runOCR(filePath) {
  try {
    const { data } = await Tesseract.recognize(filePath, 'eng', {
      logger: () => { },
    });
    return data.text || '';
  } catch (err) {
    console.error('OCR Error:', err.message);
    return '';
  }
}

function parseCSVRegister(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Normalize column names (case-insensitive)
        const normalized = {};
        for (const [k, v] of Object.entries(row)) {
          normalized[k.toLowerCase().replace(/\s+/g, '_')] = v;
        }
        records.push({
          id: uuidv4(),
          vendor_name: normalized.vendor_name || normalized.vendor || normalized.company || normalized.name || '',
          expected_amount: parseFloat((normalized.expected_amount || normalized.amount || normalized.total || '0').replace(/[$,]/g, '')) || 0,
          due_date: normalized.due_date || normalized.due || normalized.date || null,
          reference_number: normalized.reference_number || normalized.ref || normalized.invoice_number || normalized.invoice_no || null,
          status: normalized.status || 'unpaid',
        });
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
    const pendingInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'pending'").get().count;
    const matchedInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'matched'").get().count;
    const totalAmount = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as sum FROM invoices').get().sum;
    const sessions = db.prepare('SELECT COUNT(*) as count FROM reconciliation_sessions').get().count;
    const recentInvoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5').all();
    const flaggedCount = db.prepare("SELECT COUNT(*) as count FROM reconciliation_results WHERE match_status != 'matched'").get().count;
    const monthlyData = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(total_amount) as total
      FROM invoices
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC LIMIT 6
    `).all();

    res.json({
      totalInvoices,
      pendingInvoices,
      matchedInvoices,
      totalAmount,
      reconciliationSessions: sessions,
      flaggedItems: flaggedCount,
      recentInvoices,
      monthlyData: monthlyData.reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload & OCR invoice
app.post('/api/invoices/upload', uploadInvoice.array('invoices', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const results = [];
  for (const file of req.files) {
    try {
      const rawText = await runOCR(file.path);
      const parsed = parseInvoice(rawText);
      const invoiceId = uuidv4();

      const insertInvoice = db.prepare(`
        INSERT INTO invoices (id, vendor_name, invoice_number, invoice_date, due_date, subtotal, tax, total_amount, currency, file_path, file_name, ocr_raw_text, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `);
      insertInvoice.run(
        invoiceId,
        parsed.vendor_name,
        parsed.invoice_number,
        parsed.invoice_date,
        parsed.due_date,
        parsed.subtotal,
        parsed.tax,
        parsed.total_amount,
        parsed.currency,
        file.path,
        file.originalname,
        rawText,
      );

      // Insert line items
      if (parsed.line_items && parsed.line_items.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO line_items (invoice_id, description, quantity, unit_price, amount)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const item of parsed.line_items) {
          insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.amount);
        }
      }

      results.push({
        id: invoiceId,
        file_name: file.originalname,
        status: 'success',
        extracted: parsed,
        confidence: parsed.confidence,
      });
    } catch (err) {
      results.push({
        file_name: file.originalname,
        status: 'error',
        error: err.message,
      });
    }
  }

  res.json({ processed: results.length, results });
});

// Get all invoices with pagination and filtering
app.get('/api/invoices', (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, sort = 'created_at', order = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];

    if (status) { where.push("status = ?"); params.push(status); }
    if (search) {
      where.push("(vendor_name LIKE ? OR invoice_number LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const allowedSorts = ['created_at', 'vendor_name', 'total_amount', 'invoice_date'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const invoices = db.prepare(`SELECT * FROM invoices ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`)
      .all(...params, parseInt(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) as count FROM invoices ${whereClause}`).get(...params).count;

    res.json({ invoices, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invoice with line items
app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const lineItems = db.prepare('SELECT * FROM line_items WHERE invoice_id = ?').all(req.params.id);
    const reconciliationResult = db.prepare('SELECT * FROM reconciliation_results WHERE invoice_id = ?').get(req.params.id);
    res.json({ ...invoice, line_items: lineItems, reconciliation: reconciliationResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update invoice fields manually
app.put('/api/invoices/:id', (req, res) => {
  try {
    const { vendor_name, invoice_number, invoice_date, due_date, subtotal, tax, total_amount, currency, line_items } = req.body;

    const updateBatch = db.transaction(() => {
      const update = db.prepare(`
        UPDATE invoices SET vendor_name=?, invoice_number=?, invoice_date=?, due_date=?, subtotal=?, tax=?, total_amount=?, currency=?, updated_at=datetime('now')
        WHERE id=?
      `);
      const info = update.run(vendor_name, invoice_number, invoice_date, due_date, subtotal, tax, total_amount, currency, req.params.id);

      if (info.changes === 0) throw new Error('Invoice not found');

      if (line_items && Array.isArray(line_items)) {
        db.prepare('DELETE FROM line_items WHERE invoice_id = ?').run(req.params.id);
        const insertItem = db.prepare(`
          INSERT INTO line_items (invoice_id, description, quantity, unit_price, amount)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const item of line_items) {
          insertItem.run(req.params.id, item.description, item.quantity, item.unit_price, item.amount);
        }
      }
    });

    updateBatch();
    res.json({ success: true });
  } catch (err) {
    const status = err.message === 'Invoice not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.file_path && fs.existsSync(invoice.file_path)) {
      fs.unlinkSync(invoice.file_path);
    }
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload payment register CSV
app.post('/api/register/upload', uploadRegister.single('register'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No register file uploaded' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let records = [];
    if (ext === '.csv') {
      records = await parseCSVRegister(req.file.path);
    } else if (ext === '.json') {
      const raw = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));
      records = Array.isArray(raw) ? raw.map(r => ({ id: uuidv4(), ...r })) : [];
    }
    res.json({ success: true, records, count: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual link reconciliation
app.post('/api/reconcile/link', (req, res) => {
  try {
    const { invoice_id, record_id, session_id, discrepancy = 0 } = req.body;
    if (!invoice_id || !record_id) return res.status(400).json({ error: 'invoice_id and record_id required' });

    const manualUpdate = db.transaction(() => {
      // Update invoice status
      db.prepare("UPDATE invoices SET status = 'matched', updated_at = datetime('now') WHERE id = ?").run(invoice_id);

      // Update or insert reconciliation result
      const existing = db.prepare('SELECT id FROM reconciliation_results WHERE invoice_id = ?').get(invoice_id);
      if (existing) {
        db.prepare(`
          UPDATE reconciliation_results 
          SET record_id = ?, match_status = 'matched', discrepancy = ?, flag_reason = 'Manually reconciled', confidence_score = 100 
          WHERE id = ?
        `).run(record_id, discrepancy, existing.id);
      } else {
        db.prepare(`
          INSERT INTO reconciliation_results (id, invoice_id, record_id, match_status, discrepancy, flag_reason, confidence_score, session_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), invoice_id, record_id, 'matched', discrepancy, 'Manually reconciled', 100, session_id || 'manual');
      }
    });

    manualUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run reconciliation
app.post('/api/reconcile', async (req, res) => {

  try {
    const { register_records, invoice_ids } = req.body;
    if (!register_records || !Array.isArray(register_records)) {
      return res.status(400).json({ error: 'register_records array required' });
    }

    let invoices;
    if (invoice_ids && Array.isArray(invoice_ids) && invoice_ids.length > 0) {
      const placeholders = invoice_ids.map(() => '?').join(',');
      invoices = db.prepare(`SELECT * FROM invoices WHERE id IN (${placeholders})`).all(...invoice_ids);
    } else {
      invoices = db.prepare("SELECT * FROM invoices WHERE status IN ('pending', 'mismatch', 'missing')").all();
    }

    if (invoices.length === 0) {
      return res.status(400).json({ error: 'No invoices found to reconcile' });
    }

    const sessionId = uuidv4();
    const { results, summary, missingRecords } = reconcile(invoices, register_records);

    // Store results in DB
    const insertResult = db.prepare(`
      INSERT INTO reconciliation_results (id, invoice_id, record_id, match_status, discrepancy, flag_reason, confidence_score, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateInvoice = db.prepare("UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?");

    const insertMany = db.transaction(() => {
      for (const result of results) {
        insertResult.run(uuidv4(), result.invoice_id, result.record_id, result.match_status, result.discrepancy, result.flag_reason, result.confidence_score, sessionId);
        updateInvoice.run(result.match_status, result.invoice_id);
      }
    });
    insertMany();

    // Save session
    db.prepare(`
      INSERT INTO reconciliation_sessions (id, register_file_name, total_invoices, matched, mismatched, missing, duplicate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, 'Uploaded Register', summary.total_invoices, summary.matched, summary.mismatched, summary.missing_invoices, summary.duplicate);

    // Build enriched results
    const enrichedResults = results.map(r => {
      const invoice = invoices.find(i => i.id === r.invoice_id);
      const record = register_records.find(rec => rec.id === r.record_id);
      return { ...r, invoice, record };
    });

    res.json({ session_id: sessionId, summary, results: enrichedResults, missing_records: missingRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reconciliation history
app.get('/api/reconciliations', (req, res) => {
  try {
    const sessions = db.prepare('SELECT * FROM reconciliation_sessions ORDER BY created_at DESC LIMIT 20').all();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export report as CSV
app.get('/api/report/:sessionId/csv', (req, res) => {
  try {
    const results = db.prepare(`
      SELECT rr.*, i.vendor_name, i.invoice_number, i.total_amount, i.invoice_date, i.file_name
      FROM reconciliation_results rr
      LEFT JOIN invoices i ON rr.invoice_id = i.id
      WHERE rr.session_id = ?
    `).all(req.params.sessionId);

    if (results.length === 0) return res.status(404).json({ error: 'Session not found' });

    const fields = ['vendor_name', 'invoice_number', 'total_amount', 'invoice_date', 'match_status', 'discrepancy', 'flag_reason', 'confidence_score'];
    const parser = new Parser({ fields });
    const csvData = parser.parse(results);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.sessionId}.csv"`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export report as PDF
app.get('/api/report/:sessionId/pdf', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM reconciliation_sessions WHERE id = ?').get(req.params.sessionId);
    const results = db.prepare(`
      SELECT rr.*, i.vendor_name, i.invoice_number, i.total_amount, i.invoice_date
      FROM reconciliation_results rr
      LEFT JOIN invoices i ON rr.invoice_id = i.id
      WHERE rr.session_id = ?
    `).all(req.params.sessionId);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${req.params.sessionId}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#6366f1').text('Invoice Reconciliation Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#888').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Summary
    if (session) {
      doc.fontSize(14).fillColor('#333').text('Summary');
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#555');
      doc.text(`Total Invoices: ${session.total_invoices}`);
      doc.text(`Matched: ${session.matched}`);
      doc.text(`Mismatched: ${session.mismatched}`);
      doc.text(`Missing: ${session.missing}`);
      doc.text(`Duplicates: ${session.duplicate}`);
      doc.moveDown(1);
    }

    // Results table
    doc.fontSize(14).fillColor('#333').text('Reconciliation Results');
    doc.moveDown(0.5);

    const statusColors = { matched: '#22c55e', mismatch: '#f59e0b', missing: '#ef4444', duplicate: '#8b5cf6' };
    for (const r of results) {
      doc.fontSize(10).fillColor(statusColors[r.match_status] || '#333');
      doc.text(`[${(r.match_status || '').toUpperCase()}] ${r.vendor_name || 'Unknown'} — Invoice #${r.invoice_number || 'N/A'} — $${(r.total_amount || 0).toFixed(2)}`);
      if (r.flag_reason) {
        doc.fontSize(9).fillColor('#888').text(`  ⚠ ${r.flag_reason}`);
      }
      doc.moveDown(0.3);
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Invoice OCR Reconciler API running on http://localhost:${PORT}`);
});
