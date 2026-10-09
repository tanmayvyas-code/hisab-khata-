import type { BankTransaction, DuplicateCandidate, Invoice } from '../types/domain.ts';
import { computeNameSimilarity } from './reconciliationEngine.ts';

export interface DuplicateDetectorOptions {
  windowDays?: number;
}

function daysBetween(dateA: string, dateB: string): number {
  const tA = new Date(dateA).getTime();
  const tB = new Date(dateB).getTime();
  if (isNaN(tA) || isNaN(tB)) return 999;
  return Math.round(Math.abs(tA - tB) / (1000 * 60 * 60 * 24));
}

export function detectDuplicatePayments(
  shopId: string,
  transactions: BankTransaction[],
  invoices: Invoice[],
  existingStatuses: Record<string, 'possible' | 'confirmed' | 'dismissed' | 'reminded_later'> = {},
  options: DuplicateDetectorOptions = {}
): DuplicateCandidate[] {
  const windowDays = options.windowDays ?? 7;
  const outTxns = transactions
    .filter((t) => t.direction === 'out')
    .sort((a, b) => a.date.localeCompare(b.date));

  const candidates: DuplicateCandidate[] = [];
  const pairedKeys = new Set<string>();

  for (let i = 0; i < outTxns.length; i++) {
    for (let j = i + 1; j < outTxns.length; j++) {
      const t1 = outTxns[i];
      const t2 = outTxns[j];

      if (Math.abs(t1.amount - t2.amount) > 1) continue;

      const gapDays = daysBetween(t1.date, t2.date);
      if (gapDays > windowDays) continue;

      const partySim = Math.max(
        computeNameSimilarity(t1.counterpartyName, t2.counterpartyName),
        computeNameSimilarity(t1.description, t2.description)
      );

      const sameLinkedInvoice =
        Boolean(t1.linkedInvoiceId && t2.linkedInvoiceId && t1.linkedInvoiceId === t2.linkedInvoiceId);

      if (partySim < 0.65 && !sameLinkedInvoice) continue;

      const pairKey = [t1.id, t2.id].sort().join('::');
      if (pairedKeys.has(pairKey)) continue;
      pairedKeys.add(pairKey);

      const candidateId = `dup-${t1.id}-${t2.id}`;
      const savedStatus = existingStatuses[candidateId] || 'possible';
      if (savedStatus === 'dismissed') continue;

      const matchedInv = invoices.find(
        (inv) =>
          inv.id === t1.linkedInvoiceId ||
          inv.id === t2.linkedInvoiceId ||
          (inv.type === 'purchase' &&
            Math.abs(inv.total - t1.amount) <= 5 &&
            computeNameSimilarity(inv.supplierName, t1.counterpartyName || t2.counterpartyName) >= 0.65)
      );

      const evidence: string[] = [
        `Identical payout amount ₹${t1.amount.toLocaleString('en-IN')} debited twice`,
        `Same vendor "${t1.counterpartyName || matchedInv?.supplierName || 'Vendor'}" paid ${gapDays === 0 ? 'on the same day' : `${gapDays} day(s) apart`} (${t1.date} & ${t2.date})`,
      ];

      if (matchedInv) {
        evidence.push(
          `Only 1 purchase bill (${matchedInv.billNumber || matchedInv.invoiceNumber} for ₹${matchedInv.total.toLocaleString('en-IN')}) exists in records`
        );
      }
      if (t1.reference && t2.reference) {
        evidence.push(`Separate bank references: ${t1.reference} and ${t2.reference}`);
      }

      const confidence = Math.min(
        98,
        Math.round(70 + (matchedInv ? 15 : 5) + (gapDays <= 3 ? 9 : 4))
      );

      const vendorName = t1.counterpartyName || matchedInv?.supplierName || 'Vendor';
      const invRefText = matchedInv ? `Bill ${matchedInv.billNumber || matchedInv.invoiceNumber}` : 'recent bill';

      const vendorDraftMessage = `Namaste ${vendorName} ji, hamare bank statement mein ${invRefText} (₹${t1.amount.toLocaleString('en-IN')}) ka payment 2 baar gaya hai (${t1.date} Ref: ${t1.reference || 'TXN1'} aur ${t2.date} Ref: ${t2.reference || 'TXN2'}). Kripya check karke ₹${t1.amount.toLocaleString('en-IN')} refund ya agle bill mein credit note adjust kar dein. Dhanyavaad.`;

      candidates.push({
        id: candidateId,
        shopId,
        primaryTxnId: t1.id,
        duplicateTxnId: t2.id,
        invoiceId: matchedInv?.id,
        invoiceNumber: matchedInv?.billNumber || matchedInv?.invoiceNumber,
        counterpartyName: vendorName,
        amount: t1.amount,
        recoverableAmount: t2.amount,
        confidence,
        daysApart: gapDays,
        status: savedStatus,
        evidence,
        vendorDraftMessage,
      });
    }
  }

  return candidates;
}
