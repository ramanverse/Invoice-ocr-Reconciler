/**
 * Invoice Parser - Extracts structured fields from raw OCR text
 */

const PATTERNS = {
    // Invoice number patterns
    invoiceNumber: [
        /invoice\s*(?:#|no\.?|number|num\.?)[:\s]*([A-Z0-9\-\/]+)/i,
        /inv\s*[#:]?\s*([A-Z0-9\-\/]+)/i,
        /bill\s*(?:#|no\.?)[:\s]*([A-Z0-9\-\/]+)/i,
        /#\s*([A-Z0-9\-]{4,20})/i,
    ],
    // Vendor/company name
    vendorName: [
        /(?:from|bill\s*from|billed\s*by|company)[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\n|ltd|inc|llc|corp)/i,
        /^([A-Z][A-Za-z0-9\s&.,'-]{2,40}(?:Ltd|Inc|LLC|Corp|Co\.|Services|Solutions|Group))/m,
    ],
    // Date patterns
    date: [
        /(?:invoice\s*date|date\s*of\s*issue|issued?)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(?:invoice\s*date|date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
        /([A-Za-z]+ \d{1,2},? \d{4})/,
    ],
    // Due date
    dueDate: [
        /(?:due\s*date|payment\s*due|pay\s*by)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(?:due\s*date|payment\s*due|pay\s*by)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ],
    // Total amount
    total: [
        /(?:total\s*(?:amount\s*)?due|grand\s*total|amount\s*due|total)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/i,
        /total[:\s]*(?:USD|EUR|GBP|INR)?\s*([\d,]+\.?\d{0,2})/i,
    ],
    // Subtotal
    subtotal: [
        /(?:subtotal|sub\s*total)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/i,
        /(?:net\s*amount|net)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/i,
    ],
    // Tax
    tax: [
        /(?:tax|vat|gst|hst)[:\s]*(?:\d+%\s*)?\$?\s*([\d,]+\.?\d{0,2})/i,
        /(?:sales\s*tax|service\s*tax)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/i,
    ],
    // Currency
    currency: [
        /\b(USD|EUR|GBP|INR|CAD|AUD|JPY|CNY|CHF|SGD)\b/i,
        /(\$|€|£|₹|¥)/,
    ],
};

const CURRENCY_SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY' };

function parseAmount(str) {
    if (!str) return null;
    const cleaned = str.replace(/,/g, '').trim();
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
}

function extractField(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) return match[1].trim();
    }
    return null;
}

function parseLineItems(text) {
    const items = [];
    // Look for patterns like "Item Description   Qty   UnitPrice   Amount"
    const lineItemPattern = /^(.{3,40}?)\s{2,}(\d+(?:\.\d+)?)\s{1,}\$?([\d,.]+)\s{1,}\$?([\d,.]+)\s*$/gm;
    let match;
    while ((match = lineItemPattern.exec(text)) !== null) {
        const amount = parseAmount(match[4]);
        if (amount && amount > 0 && amount < 1000000) {
            items.push({
                description: match[1].trim(),
                quantity: parseFloat(match[2]) || 1,
                unit_price: parseAmount(match[3]) || amount,
                amount,
            });
        }
    }
    return items;
}

function parseInvoice(rawText) {
    const text = rawText || '';

    const invoiceNumber = extractField(text, PATTERNS.invoiceNumber);
    const vendorName = extractField(text, PATTERNS.vendorName);
    const invoiceDate = extractField(text, PATTERNS.date);
    const dueDate = extractField(text, PATTERNS.dueDate);
    const totalStr = extractField(text, PATTERNS.total);
    const subtotalStr = extractField(text, PATTERNS.subtotal);
    const taxStr = extractField(text, PATTERNS.tax);

    let currency = 'USD';
    const currencyMatch = extractField(text, PATTERNS.currency);
    if (currencyMatch) {
        currency = CURRENCY_SYMBOLS[currencyMatch] || currencyMatch.toUpperCase();
    }

    const total = parseAmount(totalStr);
    const subtotal = parseAmount(subtotalStr);
    const tax = parseAmount(taxStr);

    const lineItems = parseLineItems(text);

    // Confidence scoring based on extracted fields
    const fields = [invoiceNumber, vendorName, invoiceDate, total];
    const extractedCount = fields.filter(Boolean).length;
    const confidence = Math.round((extractedCount / fields.length) * 100);

    return {
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        vendor_name: vendorName || 'Unknown Vendor',
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        subtotal: subtotal || (total && tax ? total - tax : null) || total || 0,
        tax: tax || 0,
        total_amount: total || subtotal || 0,
        currency,
        line_items: lineItems,
        confidence,
    };
}

module.exports = { parseInvoice };
