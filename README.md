# Invoice OCR & Reconciliation Tool
An offline-first desktop tool that extracts structured data from invoice PDFs/images, matches them against expected payment records, and flags mismatches, duplicates, or missing invoices.

---

## 1. Problem Statement

### Problem Title
Automated Invoice OCR and Reconciliation System

### Problem Description
Businesses process large volumes of invoices for vendor payments and accounting reconciliation. Most invoices arrive as scanned PDFs or images, requiring manual data entry into accounting systems. Manual reconciliation is time-consuming and error-prone, especially when comparing invoice amounts with expected payment records.

### Target Users
- Accounting and finance teams in small-to-medium businesses
- Freelancers and consultants managing multiple vendor invoices
- Operations teams handling batch invoice processing and payment verification

### Existing Gaps
- No lightweight, offline desktop tool exists for end-to-end invoice OCR and reconciliation
- Enterprise solutions are expensive and cloud-dependent, raising privacy concerns
- No open-source tool reliably handles variable invoice formats combined with structured matching logic

---

## 2. Problem Understanding & Approach

### Root Cause Analysis
- Invoices are unstructured documents with no universal format
- OCR tools extract raw text but lack domain-aware parsing for invoice-specific fields like vendor name, amount, line items, and dates
- Reconciliation requires business logic — matching, deduplication, and anomaly flagging — which OCR alone cannot provide
- Without automation, accounting errors increase, duplicate payments occur, and fraud risks rise

### Solution Strategy
Build a two-stage pipeline:
1. **Extraction Stage** — Use local OCR (Tesseract.js) combined with regex and NLP heuristics to extract structured fields from invoice images and PDFs
2. **Reconciliation Stage** — Compare extracted invoice data against an expected payment register (CSV/JSON), then flag mismatches, duplicates, and missing entries

---

## 3. Proposed Solution

### Solution Overview
A desktop application (Electron or web-based local app) that allows users to upload invoice files, automatically extract key data fields, and reconcile them against their payment records — fully offline, with no data leaving the machine.

### Core Idea
Local OCR + Rule-based Structured Extraction + Fuzzy Matching Reconciliation Engine, packaged as a lightweight desktop tool that prioritizes privacy and works without an internet connection.

### Key Features
- Upload invoice PDFs or scanned images (JPG/PNG)
- Extract key fields: Vendor Name, Invoice Number, Date, Line Items, Subtotal, Tax, Total Amount
- Upload expected payment register (CSV/Excel)
- Auto-match invoices against register entries
- Flag mismatched amounts, duplicate invoice numbers, and missing invoices
- Export reconciliation report as CSV or PDF
- Fully offline — no data leaves the machine

---

## 4. System Architecture

### High-Level Flow
User → Desktop App (Frontend) → OCR Engine (Tesseract.js) → Invoice Parser → Reconciliation Engine → Report Generator → User

### Architecture Description
The frontend handles file upload and UI rendering. Uploaded files are passed to the OCR Engine (Tesseract.js) which extracts raw text from the document. The Invoice Parser applies regex and heuristics to convert raw text into structured invoice fields. The Reconciliation Engine loads the expected payment register and performs fuzzy matching against extracted invoices. Results are displayed in a dashboard and can be exported as reports.

---

## 5. Database Design

### ER Diagram
(Add system architecture diagram image here)

### ER Diagram Description
- **Invoice** — InvoiceID, VendorName, InvoiceNumber, Date, Subtotal, Tax, TotalAmount, FilePath, Status
- **LineItem** — ItemID, InvoiceID (FK), Description, Quantity, UnitPrice, Amount
- **PaymentRecord** — RecordID, VendorName, ExpectedAmount, DueDate, Status, ReferenceNumber
- **ReconciliationResult** — ResultID, InvoiceID (FK), RecordID (FK), MatchStatus, Discrepancy, FlagReason

---

## 6. Dataset Selected

### Dataset Name
Synthetic Invoice Dataset + Public Invoice Samples

### Source
- Kaggle: Invoice OCR datasets
- Self-generated synthetic invoices using invoice template generators
- Open-source sample PDFs from GitHub repositories

### Data Type
Scanned PDF invoices, PNG/JPG invoice images, structured CSV payment registers

### Selection Reason
Variable invoice formats — different layouts, fonts, and structures — are needed to stress-test both OCR extraction accuracy and the robustness of the invoice parser.

### Preprocessing Steps
- Convert PDF pages to images using pdf2image / pdfjs
- Resize and denoise images to improve OCR accuracy
- Annotate ground-truth fields for model evaluation
- Normalize vendor names and currency formats for consistent matching

---

## 7. Model Selected

### Model Name
Tesseract.js (OCR Engine) + Regex / Heuristic Parser (Field Extraction) + Fuse.js (Fuzzy String Matching)

### Selection Reasoning
- Tesseract.js runs fully in-browser or in Node.js with no external API calls, preserving user privacy
- Regex + Heuristics are fast, interpretable, and effective for well-defined invoice fields
- Fuse.js handles OCR typos and vendor name variations through fuzzy matching

### Alternatives Considered
- **Google Vision API** — Rejected due to cloud dependency and privacy risk
- **PaddleOCR** — Considered but requires a Python backend, increasing setup complexity
- **LayoutLM** — Considered for future scope; too heavy for the current MVP

### Evaluation Metrics
- Field extraction accuracy per field (vendor, amount, date, invoice number)
- Reconciliation match rate
- False positive and false negative rate for flagged mismatches
- Processing time per invoice

---

## 8. Technology Stack

- **Frontend**: React.js + Vanilla CSS (Redesigned with Premium Dark Red theme)
- **Backend**: Node.js + Express
- **ML/AI**: Tesseract.js (OCR), Fuse.js (fuzzy matching), custom regex-based invoice parser
- **Database**: SQLite (local desktop)
- **Deployment**: Electron (desktop app packaging) or localhost web server — fully offline

---

## 9. API Documentation & Testing

### API Endpoints List
- `POST /api/upload` — Upload an invoice file (PDF or image); returns extracted invoice data as JSON
- `POST /api/reconcile` — Upload a payment register CSV; returns reconciliation report as JSON
- `GET /api/invoices` — Retrieve all extracted invoices stored in the local database
- `GET /api/report/:id` — Fetch a specific reconciliation report by its ID
- `DELETE /api/invoice/:id` — Delete an invoice record from the local database

---

## 10. Module-wise Development & Deliverables

### Checkpoint 1: Research & Planning
**Deliverables**: Problem statement, system architecture diagram, ER diagram, tech stack finalization, README

### Checkpoint 2: Backend Development
**Deliverables**: Node.js + Express server setup, SQLite schema, file upload API, invoice storage module

### Checkpoint 3: Frontend Development
**Deliverables**: React UI — file upload screen, invoice list view, reconciliation dashboard, report export UI

### Checkpoint 4: OCR & Model Integration
**Deliverables**: Tesseract.js integration, regex-based invoice parser, field extraction accuracy evaluation

### Checkpoint 5: Reconciliation Engine Integration
**Deliverables**: Fuse.js fuzzy matching logic, mismatch/duplicate/missing invoice detection, flag labeling

### Checkpoint 6: Deployment
**Deliverables**: Electron packaging or localhost app, end-to-end testing, CSV/PDF report export, final demo

---

## 11. End-to-End Workflow

1. User uploads an invoice PDF or image via the desktop app
2. App converts PDF pages to images if needed
3. Tesseract.js runs OCR and extracts raw text from the document
4. Invoice Parser structures the raw text into named fields — Vendor, Invoice Number, Date, Totals, Line Items
5. Extracted invoice is saved to local SQLite with status "Pending Reconciliation"
6. User uploads the expected payment register (CSV/Excel)
7. Reconciliation Engine matches invoices to register entries using fuzzy logic
8. Mismatches, duplicates, and missing invoices are flagged and labeled
9. Dashboard displays all flags with details
10. User exports the final reconciliation report as CSV or PDF

---

## 12. Demo & Video
- **Live Demo Link**: (to be added)
- **Demo Video Link**: (to be added)
- **GitHub Repository**: [https://github.com/ramanverse/Invoice-ocr-Reconciler](https://github.com/ramanverse/Invoice-ocr-Reconciler)

---

## 13. Hackathon Deliverables Summary
- Functional desktop/web app with OCR-based invoice extraction
- Reconciliation engine with mismatch, duplicate, and missing invoice detection
- Reconciliation report export in CSV and PDF formats
- Complete README with architecture, API documentation, and workflow

---

## 14. Future Scope & Scalability

### Short-Term
- Support multi-language invoices using Tesseract multi-language models
- Add ML-based field extraction (LayoutLM) to improve accuracy on complex invoice layouts
- Email integration to auto-import invoices directly from inbox

### Long-Term
- Cloud-sync option for team collaboration
- ERP and accounting software integration (QuickBooks, Tally, Zoho Books)
- AI-powered anomaly detection for fraud identification
- Mobile app for on-the-go invoice scanning and submission

---

## 15. Known Limitations
- OCR accuracy degrades on low-quality scans, handwritten invoices, or non-standard fonts
- Regex parser may fail on highly unusual or custom invoice layouts
- Fuzzy matching can produce false positives for vendors with similar names
- No support for encrypted or password-protected PDFs in the current MVP

---

## 16. Impact
- Reduces manual data entry time by up to 80% for accounting and finance teams
- Minimizes the risk of duplicate payments and invoice fraud
- Provides small businesses with an affordable, privacy-safe alternative to expensive cloud OCR solutions
- Improves cash flow management through faster and more accurate reconciliation workflows
