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

### High-Level Workflow
`User` → `Frontend (React)` → `OCR (Tesseract.js)` → `Invoice Parser` → `Reconciliation Engine` → `Dashboard/Reports`

### Component Description
- **Frontend**: Handles multi-file uploads, UI state management, and real-time reconciliation visualization.
- **Backend (Node.js/Express)**: Manages local file storage, database operations, and environment-specific configurations.
- **OCR Engine**: Utilizes Tesseract.js for client-side/server-side text extraction from images and PDFs.
- **Reconciliation Engine**: Implements `Fuse.js` for fuzzy string matching and heuristic-based anomaly detection.

---

## 5. Database Schema

The system uses **SQLite** for local development and **PostgreSQL** for cloud production.

### Core Entities
- **Users**: Authentication data (Local & Google OAuth).
- **Invoices**: Extracted header data (Vendor, Amount, Date, etc.).
- **LineItems**: Granular product/service data from invoices.
- **ReconciliationResults**: Match statuses, discrepancies, and flag reasons.
- **ReconciliationSessions**: History and summary metrics of reconciliation runs.

---

## 6. Technology Stack

- **Core**: React.js, Node.js, Express.js
- **Styling**: Premium Dark Red (Charcoal & Crimson) with Outfit geometric typography
- **OCR**: Tesseract.js
- **Storage**: SQLite (Local), PostgreSQL (Cloud/Render)
- **Matching**: Fuse.js (Fuzzy Matching)
- **Deployment**: Vercel (Frontend), Render (Backend)

---

## 7. Documentation

All detailed project documentation is centralized in the `docs/` directory:

- 🚀 [**How to Run**](docs/how_to_run.md): Step-by-step setup for local development.
- 📊 [**Project Report**](docs/project_report.html): Comprehensive technical overview and system design choices.

---

## 8. Development Progress

### Checkpoint 1: Initialization 🏁
- Problem statement and architecture design complete.
- Repository structure established with `docs/` centralization.

### Checkpoint 2: Authentication & Security 🔐
- Manual email/password and Google OAuth integration.
- Secured API endpoints with JWT.

### Checkpoint 3: OCR & Parsing 📄
- Tesseract.js integration for PDF/image processing.
- Regex and heuristic-based invoice data extraction.

### Checkpoint 4: Reconciliation Engine 🧠
- Fuzzy matching implementation for high-accuracy reconciliation.
- Anomaly flagging for mismatches and missing records.

### Checkpoint 5: Professional UI/UX ✨
- Modern Dark Red theme implementation with glassmorphism.
- Responsive dashboard and interactive reports.

---

## 9. Live Application

The application is deployed and accessible at:
- **Frontend**: [invoice-ocr-reconciler.vercel.app](https://invoice-ocr-reconciler.vercel.app/)
- **Backend**: [invoice-ocr-backend.onrender.com](https://invoice-ocr-backend.onrender.com/)

---

## 10. License & Privacy
This tool is open-source and prioritizes data privacy through offline-first processing options. All sensitive financial data remains isolated within the user's secure environment.
