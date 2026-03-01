# Invoice OCR & Reconciler Project Report (Hinglish)

Bhai, ye project ek fully automatic system hai jo invoices se data extract karta hai aur unhe payment records ke saath match karta hai. Sab kuch offline hai!

---

## 1. Project Structure (Kaunsi Cheez Kahan Hai?)

### 📂 Root Directory
- **`README.md`**: Project ka main document. Isme architecture, tech stack, aur features ki saari details hain.
- **`.gitignore`**: Is file mein wo saare folders/files hain jinhe hum GitHub pe nahi bhejte (jaise `node_modules` ya local databases).

### 📂 Backend (`/backend`)
Ye server-side logic handle karta hai.
- **`server.js`**: Main entry point. Saare API endpoints (upload, reconcile, etc.) yahi define hain.
- **`invoiceParser.js`**: Iska kaam hai OCR se nikle hue raw text ko structured data (Vendor Name, Amount, Date) mein convert karna use karke regex aur logic.
- **`reconciliationEngine.js`**: Ye project ka dimaag hai. Ye extracted invoices ko payment registers ke saath match karta hai using fuzzy logic.
- **`db.js`**: SQLite database ka setup. Saare invoices aur reports yahi save hote hain.

### 📂 Frontend (`/frontend`)
Ye user interface (UI) hai.
- **`src/index.css`**: Saari styling yahan hai. Humne "Modern Dark Red" theme aur "Outfit" font use kiya hai premium feel ke liye.
- **`src/pages/`**: Alag-alag screen ki files:
  - **`Dashboard.jsx`**: Overview dikhata hai.
  - **`UploadInvoice.jsx`**: Jahan se invoices upload hote hain.
  - **`Reconciliation.jsx`**: Match karne wala interface.
- **`src/api.js`**: Frontend aur Backend ko connect karne wala bridge.

---

## 2. Step-by-Step Workflow (Kaise Kaam Karta Hai?)

### Step 1: Invoice Upload 📄
Jab aap invoice (PDF/Image) upload karte ho, frontend use backend ke `/api/upload` pe bhejta hai.

### Step 2: OCR & Extraction 🔍
Backend mein **Tesseract.js** text read karta hai. Phir humara **Invoice Parser** us text mein se important fields dhundhta hai (jaise "Total Amount: ₹5000"). Kyunki ye offline hai, privacy ka koi chakkar nahi!

### Step 3: Database Storage 💾
Structured data ko **SQLite** database mein save kiya jata hai "Pending Reconciliation" status ke saath.

### Step 4: Payment Register Upload 📊
User ek CSV ya JSON file upload karta hai jisme "Expected Payments" ki list hoti hai.

### Step 5: Reconciliation Logic 🧠
**Fuse.js** (Fuzzy matching) use karke hum match check karte hain. 
- Agar sab sahi hai to "Matched".
- Agar amount alag hai to "Mismatched".
- Agar register mein hai par invoice nahi mila to "Missing".

---

## 3. Design Choice (Kyun Aisa Kiya?)

### Kyun Red Theme? 🔴
User ne maanga tha ek unique aur premium look jo baaki generic AI tools jaisa na dikhe. Vibrant red obsidian black background ke saath bahut high-contrast aur sleek lagta hai.

### Kyun Outfit Font? 🔡
Inter font thoda generic tha. Outfit font geometric hai aur modern dashboards pe kaafi premium look deta hai.

### Kyun Offline? 🛡️
Invoices mein sensitive business data hota hai. Offline approach se security aur privacy 100% rehti hai.

---

Report taiyar hai bhai! Sab kuch set hai. 👍
