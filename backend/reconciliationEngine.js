const Fuse = require('fuse.js');

/**
 * Reconciliation Engine
 * Matches extracted invoices against payment register entries using fuzzy matching
 */

function normalizeAmount(amount) {
    if (typeof amount === 'string') {
        return parseFloat(amount.replace(/[$,\s]/g, '')) || 0;
    }
    return parseFloat(amount) || 0;
}

function normalizeVendor(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/\b(ltd|limited|inc|incorporated|llc|corp|corporation|co|company|pvt|private)\b\.?/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function amountMatch(invoiceAmount, recordAmount, threshold = 0.01) {
    const diff = Math.abs(invoiceAmount - recordAmount);
    const bigger = Math.max(invoiceAmount, recordAmount);
    if (bigger === 0) return { match: true, discrepancy: 0 };
    const percentDiff = diff / bigger;
    return {
        match: percentDiff <= threshold,
        discrepancy: diff,
        percentDiff: Math.round(percentDiff * 100),
    };
}

function reconcile(invoices, paymentRecords) {
    const results = [];
    const usedRecordIds = new Set();
    const invoiceNumbers = new Set();
    const duplicateInvoiceIds = new Set();

    // Detect duplicate invoice numbers within the batch
    for (const inv of invoices) {
        const key = (inv.invoice_number || '').toLowerCase().trim();
        if (key && invoiceNumbers.has(key)) {
            duplicateInvoiceIds.add(inv.id);
        } else if (key) {
            invoiceNumbers.add(key);
        }
    }

    // Build Fuse index on payment records for fuzzy vendor matching
    const fuseOptions = {
        keys: ['vendor_name'],
        threshold: 0.4,
        includeScore: true,
    };
    const normalizedRecords = paymentRecords.map(r => ({
        ...r,
        _normalized: normalizeVendor(r.vendor_name),
    }));
    const fuseData = normalizedRecords.map(r => ({
        ...r,
        vendor_name: r._normalized,
    }));
    const fuse = new Fuse(fuseData, fuseOptions);

    for (const invoice of invoices) {
        // Check for duplicates first
        if (duplicateInvoiceIds.has(invoice.id)) {
            results.push({
                invoice_id: invoice.id,
                record_id: null,
                match_status: 'duplicate',
                discrepancy: 0,
                flag_reason: `Duplicate invoice number: ${invoice.invoice_number}`,
                confidence_score: 100,
            });
            continue;
        }

        const normalizedInvoiceVendor = normalizeVendor(invoice.vendor_name);
        const invoiceAmount = normalizeAmount(invoice.total_amount);

        // Get fuzzy vendor matches
        const vendorMatches = fuse.search(normalizedInvoiceVendor);

        if (vendorMatches.length === 0) {
            // Find records with matching amounts as alternatives
            const amountBasedSuggestions = normalizedRecords
                .filter(r => !usedRecordIds.has(r.id) && amountMatch(invoiceAmount, normalizeAmount(r.expected_amount)).match)
                .slice(0, 3)
                .map(r => ({ record: r, reason: 'Matching amount', confidence: 50 }));

            results.push({
                invoice_id: invoice.id,
                record_id: null,
                match_status: 'missing',
                discrepancy: invoiceAmount,
                flag_reason: `No matching vendor found in payment register for: ${invoice.vendor_name}`,
                confidence_score: 0,
                suggestions: amountBasedSuggestions,
            });
            continue;
        }

        // Try to find best match considering both vendor name and amount
        let bestMatch = null;
        let bestScore = Infinity;
        const candidates = [];

        for (const vendorMatch of vendorMatches.slice(0, 10)) {
            const record = normalizedRecords.find(r => r.id === vendorMatch.item.id);
            if (!record) continue;

            const recordAmount = normalizeAmount(record.expected_amount);
            const amountResult = amountMatch(invoiceAmount, recordAmount);

            const vendorScore = vendorMatch.score || 0;
            const amountScore = amountResult.percentDiff ? amountResult.percentDiff / 100 : 0;
            const combinedScore = vendorScore * 0.6 + amountScore * 0.4;

            const candidate = {
                record,
                amountResult,
                vendorScore,
                combinedScore,
                confidence: Math.round((1 - combinedScore) * 100),
                isUsed: usedRecordIds.has(record.id)
            };
            candidates.push(candidate);

            if (!usedRecordIds.has(record.id) && combinedScore < bestScore) {
                bestScore = combinedScore;
                bestMatch = candidate;
            }
        }

        if (!bestMatch) {
            results.push({
                invoice_id: invoice.id,
                record_id: null,
                match_status: 'missing',
                discrepancy: invoiceAmount,
                flag_reason: `All potential matching records already used. Vendor: ${invoice.vendor_name}`,
                confidence_score: 0,
                suggestions: candidates.slice(0, 3).map(c => ({
                    record: c.record,
                    reason: `Fuzzy vendor match (${c.confidence}%) - Already linked to another invoice`,
                    confidence: c.confidence
                }))
            });
            continue;
        }

        const { record, amountResult, vendorScore, confidence } = bestMatch;
        const recordAmount = normalizeAmount(record.expected_amount);

        if (amountResult.match && vendorScore < 0.3) {
            // Good match
            usedRecordIds.add(record.id);
            results.push({
                invoice_id: invoice.id,
                record_id: record.id,
                match_status: 'matched',
                discrepancy: amountResult.discrepancy,
                flag_reason: null,
                confidence_score: Math.max(confidence, 70),
            });
        } else {
            // Mismatch - flag it
            const reasons = [];
            if (!amountResult.match) {
                reasons.push(`Amount mismatch: Invoice $${invoiceAmount.toFixed(2)} vs Expected $${recordAmount.toFixed(2)} (${amountResult.percentDiff}% difference)`);
            }
            if (vendorScore >= 0.3) {
                reasons.push(`Vendor name fuzzy match confidence: ${Math.round((1 - vendorScore) * 100)}%`);
            }

            usedRecordIds.add(record.id);
            results.push({
                invoice_id: invoice.id,
                record_id: record.id,
                match_status: 'mismatch',
                discrepancy: amountResult.discrepancy,
                flag_reason: reasons.join('; '),
                confidence_score: confidence,
                suggestions: candidates.filter(c => c.record.id !== record.id).slice(0, 3).map(c => ({
                    record: c.record,
                    reason: `Alternative fuzzy match (${c.confidence}% confidence)`,
                    confidence: c.confidence
                }))
            });
        }
    }

    // Find payment records with no matching invoice (missing invoices)
    const missingRecords = paymentRecords.filter(r => !usedRecordIds.has(r.id));

    const summary = {
        total_invoices: invoices.length,
        matched: results.filter(r => r.match_status === 'matched').length,
        mismatched: results.filter(r => r.match_status === 'mismatch').length,
        missing_invoices: results.filter(r => r.match_status === 'missing').length,
        duplicate: results.filter(r => r.match_status === 'duplicate').length,
        missing_records: missingRecords.length,
        total_amount_invoiced: invoices.reduce((sum, i) => sum + normalizeAmount(i.total_amount), 0),
        total_amount_expected: paymentRecords.reduce((sum, r) => sum + normalizeAmount(r.expected_amount), 0),
    };

    return { results, summary, missingRecords };
}

module.exports = { reconcile };
