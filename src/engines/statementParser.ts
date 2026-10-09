import type { BankTransaction } from '../types/domain.ts';

export class StatementParseError extends Error {
  code = 'UNSUPPORTED_STATEMENT_FORMAT';
  constructor(message = 'Statement format supported nahi hai.') {
    super(message);
    this.name = 'StatementParseError';
  }
}

function normalizeDate(raw: string): string {
  const cleaned = raw.trim().replace(/\//g, '-');
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  // DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD-MMM-YYYY
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '2026-04-15';
}

function parseNumeric(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[₹,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const num = Number(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

export function extractCounterpartyAndRef(description: string, explicitRef?: string): {
  counterpartyName?: string;
  reference?: string;
} {
  let reference = explicitRef?.trim() || undefined;
  let counterpartyName: string | undefined;

  const desc = description.trim();

  // Pattern: UPI/UTR/PARTY NAME/REMARKS or NEFT-UTR-PARTY NAME-INV
  const slashParts = desc.split('/').map((s) => s.trim()).filter(Boolean);
  if (slashParts.length >= 3 && /^(UPI|IMPS|NEFT|RTGS)$/i.test(slashParts[0])) {
    if (!reference && /^\d{6,16}|[A-Z0-9]{8,20}$/i.test(slashParts[1])) {
      reference = slashParts[1];
    }
    const rawParty = slashParts[2];
    if (rawParty && !/^(UPI|PAYMENT|BILL|NA|OKAXIS|OKHDFCBANK|YBL)$/i.test(rawParty)) {
      counterpartyName = toTitleCase(rawParty.replace(/@.*$/, ''));
    }
  }

  if (!counterpartyName) {
    const dashParts = desc.split('-').map((s) => s.trim()).filter(Boolean);
    if (dashParts.length >= 3 && /^(NEFT|IMPS|RTGS|UPI|ACH)$/i.test(dashParts[0])) {
      if (!reference) reference = dashParts[1];
      counterpartyName = toTitleCase(dashParts[2]);
    }
  }

  if (!reference) {
    const utrMatch = desc.match(/\b(UTR\d+|REF\d+|\d{12})\b/i);
    if (utrMatch) reference = utrMatch[1];
  }

  if (!counterpartyName) {
    // Check known common patterns like "BY TRANSFER - RAHUL SHARMA" or "TO GUPTA TRADERS"
    const toFrom = desc.match(/(?:TO|FROM|BY)\s+([A-Za-z][A-Za-z\s.&]{2,35}?)(?:\s+INV|\s+BILL|\s+REF|$)/i);
    if (toFrom) {
      counterpartyName = toTitleCase(toFrom[1].trim());
    }
  }

  return { counterpartyName, reference };
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function computeNormalizedHash(
  shopId: string,
  date: string,
  amount: number,
  direction: 'in' | 'out',
  description: string,
  reference?: string
): string {
  const cleanDesc = description.toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanRef = (reference || '').toLowerCase().trim();
  return `${shopId}|${date}|${direction}|${Math.round(amount)}|${cleanRef}|${cleanDesc.slice(0, 48)}`;
}

export function parseBankStatementContent(
  shopId: string,
  statementId: string,
  content: string,
  fileName: string
): BankTransaction[] {
  const lowerName = fileName.toLowerCase();
  if (!content || content.trim().length < 10) {
    throw new StatementParseError('Statement format supported nahi hai.');
  }

  // If binary PDF without extracted text rows
  if (content.startsWith('%PDF-') && !content.includes('Date') && !content.includes('Narration')) {
    throw new StatementParseError('Statement format supported nahi hai.');
  }

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    throw new StatementParseError('Statement format supported nahi hai.');
  }

  // Detect delimiter (comma, tab, pipe, or multi-space for PDF text tables)
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes('|') ? '|' : ',';

  let headerIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitCsvLine(lines[i], delimiter).map((c) => c.toLowerCase());
    const hasDate = cols.some((c) => c.includes('date') || c.includes('dt'));
    const hasDesc = cols.some(
      (c) => c.includes('narration') || c.includes('description') || c.includes('particular') || c.includes('remarks')
    );
    if (hasDate && hasDesc) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new StatementParseError(
      lowerName.endsWith('.pdf')
        ? 'Statement format supported nahi hai.'
        : 'Statement format supported nahi hai. Header columns (Date, Narration, Debit/Credit) nahi mile.'
    );
  }

  const dateCol = headers.findIndex((c) => c.includes('date') || c.includes('dt'));
  const descCol = headers.findIndex(
    (c) => c.includes('narration') || c.includes('description') || c.includes('particular') || c.includes('remarks')
  );
  const debitCol = headers.findIndex((c) => c.includes('debit') || c.includes('withdrawal') || c.includes('dr'));
  const creditCol = headers.findIndex((c) => c.includes('credit') || c.includes('deposit') || c.includes('cr'));
  const amountCol = headers.findIndex((c) => c === 'amount' || c.includes('txn amount'));
  const dirCol = headers.findIndex((c) => c.includes('type') || c.includes('direction') || c === 'dr/cr');
  const balanceCol = headers.findIndex((c) => c.includes('balance') || c.includes('bal'));
  const refCol = headers.findIndex(
    (c) => c.includes('ref') || c.includes('utr') || c.includes('cheque') || c.includes('chq') || c.includes('txn id')
  );
  const partyCol = headers.findIndex((c) => c.includes('counterparty') || c.includes('party'));

  const transactions: BankTransaction[] = [];
  const seenHashes = new Set<string>();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length <= Math.max(dateCol, descCol)) continue;

    const rawDate = cols[dateCol];
    const description = cols[descCol];
    if (!rawDate || !description) continue;

    const date = normalizeDate(rawDate);
    let debit = debitCol >= 0 ? parseNumeric(cols[debitCol]) : 0;
    let credit = creditCol >= 0 ? parseNumeric(cols[creditCol]) : 0;

    if (debit === 0 && credit === 0 && amountCol >= 0) {
      const amt = parseNumeric(cols[amountCol]);
      const dirRaw = dirCol >= 0 ? (cols[dirCol] || '').toLowerCase() : '';
      if (dirRaw.includes('dr') || dirRaw.includes('out') || dirRaw.includes('debit')) {
        debit = amt;
      } else {
        credit = amt;
      }
    }

    const amount = debit > 0 ? debit : credit;
    if (amount <= 0) continue;

    const direction: 'in' | 'out' = credit > 0 ? 'in' : 'out';
    const balance = balanceCol >= 0 ? parseNumeric(cols[balanceCol]) : 0;
    const explicitRef = refCol >= 0 ? cols[refCol] : undefined;
    const explicitParty = partyCol >= 0 ? cols[partyCol] : undefined;

    const extracted = extractCounterpartyAndRef(description, explicitRef);
    const counterpartyName = explicitParty || extracted.counterpartyName;
    const reference = extracted.reference;

    const normalizedHash = computeNormalizedHash(shopId, date, amount, direction, description, reference);
    if (seenHashes.has(normalizedHash)) {
      continue;
    }
    seenHashes.add(normalizedHash);

    transactions.push({
      id: `btxn-${statementId}-${transactions.length + 1}`,
      shopId,
      statementId,
      date,
      description,
      debit,
      credit,
      amount,
      direction,
      balance,
      txnId: reference,
      reference,
      counterpartyName,
      normalizedHash,
      matchStatus: 'unmatched',
      createdAt: new Date().toISOString(),
    });
  }

  if (transactions.length === 0) {
    throw new StatementParseError('Statement format supported nahi hai.');
  }

  return transactions;
}
