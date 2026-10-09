import type {
  BankTransaction,
  Customer,
  Invoice,
  InvoiceStatus,
  MatchAlternative,
  MatchSignalReason,
  Payment,
  ReconciliationMatch,
  Supplier,
} from '../types/domain.ts';

export const RECONCILIATION_WEIGHTS = {
  amount: 30,
  invoiceNumberInText: 20,
  referenceMatch: 10,
  counterpartySimilarity: 15,
  dateProximity: 10,
  descriptionKeywords: 5,
  partyHistory: 5,
  balanceFit: 5,
} as const;

export const RECONCILIATION_THRESHOLDS = {
  strongMatch: 85,
  possibleMatch: 60,
  shortPaymentRatioMax: 0.05, // 1-5% short payment tolerance
  roundingToleranceINR: 5,
} as const;

const ABBREVIATION_MAP: Record<string, string> = {
  trdrs: 'traders',
  trd: 'traders',
  ent: 'enterprises',
  hw: 'hardware',
  hdw: 'hardware',
  shri: 'shree',
  sri: 'shree',
  bros: 'brothers',
  co: 'company',
  kr: 'kumar',
};

function normalizePartyTokens(name?: string): string[] {
  if (!name) return [];
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATION_MAP[t] || t);
}

export function computeNameSimilarity(nameA?: string, nameB?: string): number {
  const tokensA = normalizePartyTokens(nameA);
  const tokensB = normalizePartyTokens(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matches = 0;
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a === b) {
        matches += 1;
        break;
      }
      // Initial or prefix match (e.g. "R" or "Rah" for "Rahul")
      if ((a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b))) {
        matches += 0.85;
        break;
      }
      if (a.length === 1 && b.startsWith(a)) {
        matches += 0.5;
        break;
      }
    }
  }
  const denom = Math.max(tokensA.length, tokensB.length);
  return Math.min(1, matches / denom);
}

function daysBetween(dateA: string, dateB: string): number {
  const tA = new Date(dateA).getTime();
  const tB = new Date(dateB).getTime();
  if (isNaN(tA) || isNaN(tB)) return 999;
  return Math.round(Math.abs(tA - tB) / (1000 * 60 * 60 * 24));
}

export function scoreTransactionAgainstInvoice(
  txn: BankTransaction,
  inv: Invoice,
  existingPayments: Payment[],
  customers: Customer[],
  suppliers: Supplier[]
): {
  confidence: number;
  derivedStatus: InvoiceStatus;
  reasons: MatchSignalReason[];
} {
  // Direction check: sale invoice expects 'in' (credit), purchase invoice expects 'out' (debit)
  const expectedDir = inv.type === 'sale' ? 'in' : 'out';
  if (txn.direction !== expectedDir) {
    return {
      confidence: 0,
      derivedStatus: 'unknown',
      reasons: [],
    };
  }

  const reasons: MatchSignalReason[] = [];
  const invRemaining = Math.max(0, inv.total - inv.paidAmount);
  const targetAmount = invRemaining > 0 ? invRemaining : inv.total;
  const diff = txn.amount - targetAmount;
  const absDiff = Math.abs(diff);
  const ratioDiff = targetAmount > 0 ? absDiff / targetAmount : 1;

  // 1. Amount signal (max 30)
  let amountPoints = 0;
  let amountDetail = '';
  let derivedStatus: InvoiceStatus = 'paid';

  if (absDiff <= RECONCILIATION_THRESHOLDS.roundingToleranceINR) {
    amountPoints = RECONCILIATION_WEIGHTS.amount; // 30
    amountDetail = `✓ Exact amount match ₹${txn.amount.toLocaleString('en-IN')}`;
    derivedStatus = 'paid';
  } else if (diff < 0 && ratioDiff <= RECONCILIATION_THRESHOLDS.shortPaymentRatioMax) {
    amountPoints = 24;
    amountDetail = `⚠ Short payment by ₹${Math.round(absDiff).toLocaleString('en-IN')} (${(ratioDiff * 100).toFixed(1)}% below bill)`;
    derivedStatus = 'short';
  } else if (diff > 0 && ratioDiff <= 0.35) {
    amountPoints = 22;
    amountDetail = `⚠ Overpayment of ₹${Math.round(diff).toLocaleString('en-IN')} over invoice ₹${targetAmount.toLocaleString('en-IN')}`;
    derivedStatus = 'overpaid';
  } else if (diff < 0 && txn.amount >= targetAmount * 0.25) {
    amountPoints = 18;
    amountDetail = `⚠ Partial payment ₹${txn.amount.toLocaleString('en-IN')} against ₹${targetAmount.toLocaleString('en-IN')}`;
    derivedStatus = 'partial';
  } else {
    amountPoints = 0;
    amountDetail = `✗ Amount ₹${txn.amount.toLocaleString('en-IN')} differs from invoice ₹${targetAmount.toLocaleString('en-IN')}`;
    derivedStatus = 'unknown';
  }

  reasons.push({
    signal: 'amount',
    label: 'Amount Match',
    matched: amountPoints >= 18,
    weight: RECONCILIATION_WEIGHTS.amount,
    earned: amountPoints,
    detail: amountDetail,
  });

  // 2. Invoice number / bill number in reference/description (max 20)
  const descUpper = `${txn.description} ${txn.reference || ''}`.toUpperCase();
  const invNumUpper = inv.invoiceNumber.toUpperCase();
  const billNumUpper = (inv.billNumber || '').toUpperCase();
  const invDigits = invNumUpper.replace(/[^0-9]/g, '');

  let invNoPoints = 0;
  let invNoDetail = '';
  if (
    (invNumUpper && descUpper.includes(invNumUpper)) ||
    (billNumUpper && billNumUpper.length >= 3 && descUpper.includes(billNumUpper))
  ) {
    invNoPoints = RECONCILIATION_WEIGHTS.invoiceNumberInText; // 20
    invNoDetail = `✓ Invoice/Bill # (${inv.billNumber || inv.invoiceNumber}) found in narration`;
  } else if (invDigits.length >= 3 && descUpper.includes(invDigits)) {
    invNoPoints = 14;
    invNoDetail = `✓ Invoice digits (${invDigits}) found in bank description`;
  } else {
    invNoPoints = 0;
    invNoDetail = `✗ Invoice number not mentioned in narration`;
  }

  reasons.push({
    signal: 'invoiceNumberInText',
    label: 'Invoice / Bill Number',
    matched: invNoPoints > 0,
    weight: RECONCILIATION_WEIGHTS.invoiceNumberInText,
    earned: invNoPoints,
    detail: invNoDetail,
  });

  // 3. Transaction reference matches known payment/invoice reference (max 10)
  const matchingPaymentRef = existingPayments.find(
    (p) =>
      p.invoiceId === inv.id &&
      p.reference &&
      txn.reference &&
      p.reference.toLowerCase() === txn.reference.toLowerCase()
  );
  const hasStructuredUtr = Boolean(txn.reference && txn.reference.length >= 6);
  const refPoints = matchingPaymentRef
    ? RECONCILIATION_WEIGHTS.referenceMatch
    : hasStructuredUtr && invNoPoints > 0
      ? 8
      : hasStructuredUtr
        ? 5
        : 0;
  reasons.push({
    signal: 'referenceMatch',
    label: 'UTR / Reference Verification',
    matched: refPoints >= 5,
    weight: RECONCILIATION_WEIGHTS.referenceMatch,
    earned: refPoints,
    detail:
      refPoints >= 8
        ? `✓ Verified UTR reference (${txn.reference})`
        : refPoints > 0
          ? `✓ Bank reference ${txn.reference} extracted`
          : `✗ No matching payment reference`,
  });

  // 4. Counterparty name similarity (max 15)
  const invPartyName = inv.customerName || inv.supplierName || '';
  const sim = Math.max(
    computeNameSimilarity(txn.counterpartyName, invPartyName),
    computeNameSimilarity(txn.description, invPartyName)
  );
  const namePoints = Math.round(sim * RECONCILIATION_WEIGHTS.counterpartySimilarity);
  reasons.push({
    signal: 'counterpartySimilarity',
    label: 'Counterparty Name Match',
    matched: namePoints >= 9,
    weight: RECONCILIATION_WEIGHTS.counterpartySimilarity,
    earned: namePoints,
    detail:
      namePoints >= 12
        ? `✓ Party "${txn.counterpartyName || invPartyName}" matches "${invPartyName}"`
        : namePoints >= 7
          ? `⚠ Partial name match ("${txn.counterpartyName || 'Narration'}" ~ "${invPartyName}")`
          : `✗ Party name "${invPartyName}" not clearly in narration`,
  });

  // 5. Date proximity to invoice date / due date (max 10)
  const distIssue = daysBetween(txn.date, inv.issueDate);
  const distDue = daysBetween(txn.date, inv.dueDate);
  const minDays = Math.min(distIssue, distDue);
  const isAfterIssue = new Date(txn.date).getTime() >= new Date(inv.issueDate).getTime() - 86400000;

  let datePoints = 0;
  if (isAfterIssue && minDays <= 5) {
    datePoints = 10;
  } else if (isAfterIssue && minDays <= 15) {
    datePoints = 8;
  } else if (isAfterIssue && minDays <= 35) {
    datePoints = 5;
  } else if (minDays <= 60) {
    datePoints = 2;
  }
  reasons.push({
    signal: 'dateProximity',
    label: 'Date Proximity',
    matched: datePoints >= 5,
    weight: RECONCILIATION_WEIGHTS.dateProximity,
    earned: datePoints,
    detail:
      datePoints >= 8
        ? `✓ Paid within ${minDays} days of invoice/due date`
        : datePoints >= 5
          ? `✓ Paid ${minDays} days from invoice date`
          : `✗ ${minDays} days apart from invoice date`,
  });

  // 6. Payment description keywords (max 5)
  const hasKeywords = /\b(INV|BILL|PAYMENT|UDHAAR|KHATA|SETTLE|ADVANCE|BAL|SUPPLIER|PURCHASE|SALE)\b/i.test(
    txn.description
  );
  const kwPoints = hasKeywords ? 5 : 2;
  reasons.push({
    signal: 'descriptionKeywords',
    label: 'Narration Keywords',
    matched: hasKeywords,
    weight: RECONCILIATION_WEIGHTS.descriptionKeywords,
    earned: kwPoints,
    detail: hasKeywords ? '✓ Business payment keywords in narration' : '✗ Generic bank transfer narration',
  });

  // 7. Customer / Supplier relationship & historical behaviour (max 5)
  const knownCustomer = inv.customerId ? customers.find((c) => c.id === inv.customerId) : undefined;
  const knownSupplier = inv.supplierId ? suppliers.find((s) => s.id === inv.supplierId) : undefined;
  const histPoints = knownCustomer || knownSupplier ? (sim >= 0.5 ? 5 : 3) : 0;
  reasons.push({
    signal: 'partyHistory',
    label: 'Historical Party Behaviour',
    matched: histPoints >= 4,
    weight: RECONCILIATION_WEIGHTS.partyHistory,
    earned: histPoints,
    detail:
      histPoints >= 4
        ? `✓ Matches regular ${knownCustomer ? 'customer' : 'supplier'} payment pattern`
        : '✗ Insufficient party payment history match',
  });

  // 8. Outstanding balance fit (max 5)
  const balPoints =
    absDiff <= RECONCILIATION_THRESHOLDS.roundingToleranceINR
      ? 5
      : txn.amount <= inv.total * 1.35 && txn.amount >= inv.total * 0.25
        ? 3
        : 0;
  reasons.push({
    signal: 'balanceFit',
    label: 'Open Balance Fit',
    matched: balPoints >= 3,
    weight: RECONCILIATION_WEIGHTS.balanceFit,
    earned: balPoints,
    detail:
      balPoints === 5
        ? '✓ Settles invoice open balance cleanly'
        : balPoints === 3
          ? '⚠ Adjusts open balance partially or with variance'
          : '✗ Does not fit open balance',
  });

  const totalScore = Math.min(
    100,
    reasons.reduce((acc, r) => acc + r.earned, 0)
  );

  return {
    confidence: totalScore,
    derivedStatus,
    reasons,
  };
}

export function runReconciliation(
  shopId: string,
  transactions: BankTransaction[],
  invoices: Invoice[],
  existingPayments: Payment[],
  customers: Customer[],
  suppliers: Supplier[],
  existingUserDecisions: ReconciliationMatch[] = []
): {
  matches: ReconciliationMatch[];
  updatedTransactions: BankTransaction[];
  updatedInvoices: Invoice[];
} {
  const matches: ReconciliationMatch[] = [];
  const invoiceLinkedTotals = new Map<string, number>();
  const invoiceLinkedTxns = new Map<string, string[]>();

  const decisionByTxnId = new Map<string, ReconciliationMatch>();
  for (const dec of existingUserDecisions) {
    if (dec.status === 'user_confirmed' || dec.status === 'rejected') {
      decisionByTxnId.set(dec.bankTransactionId, dec);
    }
  }

  const updatedTransactions: BankTransaction[] = transactions.map((t) => ({ ...t }));

  for (const txn of updatedTransactions) {
    const manualDecision = decisionByTxnId.get(txn.id);
    if (manualDecision && manualDecision.status === 'user_confirmed' && manualDecision.invoiceId) {
      matches.push(manualDecision);
      txn.linkedInvoiceId = manualDecision.invoiceId;
      txn.matchStatus = manualDecision.derivedStatus === 'overpaid' ? 'overpaid' : 'matched';
      const prev = invoiceLinkedTotals.get(manualDecision.invoiceId) || 0;
      invoiceLinkedTotals.set(manualDecision.invoiceId, prev + txn.amount);
      const list = invoiceLinkedTxns.get(manualDecision.invoiceId) || [];
      list.push(txn.id);
      invoiceLinkedTxns.set(manualDecision.invoiceId, list);
      continue;
    }

    // Score against all candidate invoices of matching direction
    const scored = invoices
      .map((inv) => {
        if (manualDecision?.status === 'rejected' && manualDecision.invoiceId === inv.id) {
          return { inv, confidence: 0, derivedStatus: 'unknown' as InvoiceStatus, reasons: [] };
        }
        const res = scoreTransactionAgainstInvoice(txn, inv, existingPayments, customers, suppliers);
        return { inv, ...res };
      })
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];
    const alternatives: MatchAlternative[] = scored.slice(1, 4).map((alt) => ({
      invoiceId: alt.inv.id,
      invoiceNumber: alt.inv.invoiceNumber,
      partyName: alt.inv.customerName || alt.inv.supplierName || 'Unknown',
      invoiceTotal: alt.inv.total,
      issueDate: alt.inv.issueDate,
      confidence: alt.confidence,
      summaryReason: alt.reasons.filter((r) => r.matched).map((r) => r.label).join(', ') || 'Low signal match',
    }));

    if (!best || best.confidence < RECONCILIATION_THRESHOLDS.possibleMatch) {
      txn.matchStatus = 'unmatched';
      txn.linkedInvoiceId = undefined;
      matches.push({
        id: `rmatch-${txn.id}`,
        shopId,
        bankTransactionId: txn.id,
        invoiceId: undefined,
        confidence: best ? best.confidence : 18,
        status: 'unmatched',
        derivedStatus: 'unknown',
        reasons: best
          ? best.reasons
          : [
              {
                signal: 'amount',
                label: 'Amount & Narration Check',
                matched: false,
                weight: 100,
                earned: 18,
                detail: '✗ Ye payment kisi bill se confidently match nahi ho rahi.',
              },
            ],
        alternatives,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    if (best.confidence >= RECONCILIATION_THRESHOLDS.strongMatch) {
      const prevTxns = invoiceLinkedTxns.get(best.inv.id) || [];
      const isSecondExactPayment =
        prevTxns.length > 0 && Math.abs(txn.amount - best.inv.total) <= RECONCILIATION_THRESHOLDS.roundingToleranceINR;

      const derivedStatus: InvoiceStatus = isSecondExactPayment ? 'duplicate' : best.derivedStatus;
      txn.linkedInvoiceId = best.inv.id;
      txn.matchStatus =
        derivedStatus === 'duplicate'
          ? 'duplicate'
          : derivedStatus === 'overpaid'
            ? 'overpaid'
            : derivedStatus === 'short'
              ? 'short'
              : derivedStatus === 'partial'
                ? 'partial'
                : 'matched';

      const prevTotal = invoiceLinkedTotals.get(best.inv.id) || 0;
      invoiceLinkedTotals.set(best.inv.id, prevTotal + txn.amount);
      prevTxns.push(txn.id);
      invoiceLinkedTxns.set(best.inv.id, prevTxns);

      matches.push({
        id: `rmatch-${txn.id}`,
        shopId,
        bankTransactionId: txn.id,
        invoiceId: best.inv.id,
        confidence: best.confidence,
        status: 'auto_confirmed',
        derivedStatus,
        reasons: best.reasons,
        alternatives,
        createdAt: new Date().toISOString(),
      });
    } else {
      // 60 - 84: Possible match, NEVER auto-assign! Goes to Payment Inbox
      txn.linkedInvoiceId = undefined;
      txn.matchStatus = 'possible';
      matches.push({
        id: `rmatch-${txn.id}`,
        shopId,
        bankTransactionId: txn.id,
        invoiceId: best.inv.id,
        confidence: best.confidence,
        status: 'suggested',
        derivedStatus: best.derivedStatus,
        reasons: best.reasons,
        alternatives,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Derive updated Invoice statuses
  const updatedInvoices: Invoice[] = invoices.map((inv) => {
    const linkedBankTotal = invoiceLinkedTotals.get(inv.id);
    const linkedTxnIds = invoiceLinkedTxns.get(inv.id) || [];
    if (linkedBankTotal === undefined) {
      return { ...inv };
    }

    let status: InvoiceStatus = inv.status;
    const diff = linkedBankTotal - inv.total;
    const absDiff = Math.abs(diff);

    if (linkedTxnIds.length >= 2 && linkedBankTotal >= inv.total * 1.8) {
      status = 'duplicate';
    } else if (absDiff <= RECONCILIATION_THRESHOLDS.roundingToleranceINR) {
      status = 'paid';
    } else if (diff > RECONCILIATION_THRESHOLDS.roundingToleranceINR) {
      status = 'overpaid';
    } else if (diff < 0 && Math.abs(diff) / inv.total <= RECONCILIATION_THRESHOLDS.shortPaymentRatioMax) {
      status = 'short';
    } else if (linkedBankTotal > 0 && linkedBankTotal < inv.total) {
      status = 'partial';
    }

    return {
      ...inv,
      paidAmount: linkedBankTotal,
      status,
    };
  });

  return {
    matches,
    updatedTransactions,
    updatedInvoices,
  };
}
