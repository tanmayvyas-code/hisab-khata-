import { LOAN_READINESS_DISCLAIMER } from '../i18n/translations.ts';
import type {
  CashflowForecast,
  CollectFirstItem,
  FinancialHealthBreakdown,
  LoanReadinessBreakdown,
  LostMoneySummary,
  MonthlyRevenuePoint,
  Shop,
} from '../types/domain.ts';

export interface CreditPackPayload {
  shop: Shop;
  generatedAt: string;
  financialHealth: FinancialHealthBreakdown;
  loanReadiness: LoanReadinessBreakdown;
  lostMoney: LostMoneySummary;
  cashflow: CashflowForecast;
  collections: CollectFirstItem[];
  monthlySeries: MonthlyRevenuePoint[];
}

function escapePdfString(input: string): string {
  // Replace ₹ with INR for standard PDF Helvetica Type1 compatibility
  const ascii = input
    .replace(/₹/g, 'INR ')
    .replace(/[—–]/g, '-')
    .replace(/[•·]/g, '*')
    .replace(/[^\x20-\x7E]/g, '');
  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function generateCreditPackPdfBytes(payload: CreditPackPayload): Uint8Array {
  const {
    shop,
    generatedAt,
    financialHealth,
    loanReadiness,
    lostMoney,
    cashflow,
    collections,
    monthlySeries,
  } = payload;

  // Build Page 1 and Page 2 content streams
  const p1Lines: string[] = [];
  const addText = (
    lines: string[],
    x: number,
    y: number,
    text: string,
    font: 'F1' | 'F2' = 'F1',
    size = 10
  ) => {
    lines.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfString(text)}) Tj ET`);
  };
  const addRect = (lines: string[], x: number, y: number, w: number, h: number, grayFill?: number) => {
    if (grayFill !== undefined) {
      lines.push(`${grayFill} g ${x} ${y} ${w} ${h} re f 0 g`);
    } else {
      lines.push(`0.82 G 0.8 w ${x} ${y} ${w} ${h} re S 0 G`);
    }
  };

  // --- PAGE 1: Cover, Shop Profile, Financial Summary, Monthly Revenue Trend, Cash Flow ---
  addRect(p1Lines, 40, 745, 515, 55, 0.94);
  addText(p1Lines, 52, 778, 'AI MUNIM - MSME LENDER CREDIT PACK & FINANCIAL DOSSIER', 'F2', 13);
  addText(p1Lines, 52, 760, `Generated: ${generatedAt.slice(0, 10)} | Document Ref: CP-${shop.id.toUpperCase()}`, 'F1', 9);

  // Shop Profile Box
  addRect(p1Lines, 40, 665, 515, 70);
  addText(p1Lines, 52, 718, `Business Name: ${shop.shopName}`, 'F2', 11);
  addText(p1Lines, 52, 702, `Proprietor: ${shop.ownerName} | Mobile: ${shop.mobile} | Email: ${shop.email}`, 'F1', 9);
  addText(p1Lines, 52, 687, `Address: ${shop.address} | GSTIN: ${shop.gstin || '08AABCA8912K1Z2'}`, 'F1', 9);
  addText(p1Lines, 52, 672, `Business Category: ${shop.businessType.toUpperCase()} | Operational Vintage: ${shop.vintageMonths} Months`, 'F1', 9);

  // Key Scores Summary Strip
  addRect(p1Lines, 40, 600, 165, 54);
  addText(p1Lines, 50, 636, 'FINANCIAL HEALTH SCORE', 'F2', 8);
  addText(p1Lines, 50, 616, `${financialHealth.score} / 100 (${financialHealth.status})`, 'F2', 12);

  addRect(p1Lines, 215, 600, 165, 54);
  addText(p1Lines, 225, 636, 'LOAN READINESS INDICATOR', 'F2', 8);
  addText(p1Lines, 225, 616, `${loanReadiness.score} / 100`, 'F2', 12);

  addRect(p1Lines, 390, 600, 165, 54);
  addText(p1Lines, 400, 636, 'HIGH-PRIORITY RECOVERY', 'F2', 8);
  addText(p1Lines, 400, 616, `INR ${lostMoney.heroRecoveryTotal.toLocaleString('en-IN')}`, 'F2', 12);

  // Monthly Revenue & Collection Trend Table
  addText(p1Lines, 40, 578, '1. MONTHLY REVENUE, COLLECTIONS & EXPENSE TREND (6 MONTHS)', 'F2', 11);
  addRect(p1Lines, 40, 554, 515, 18, 0.92);
  addText(p1Lines, 50, 560, 'Month', 'F2', 9);
  addText(p1Lines, 140, 560, 'Billed Revenue', 'F2', 9);
  addText(p1Lines, 260, 560, 'Realized Collection', 'F2', 9);
  addText(p1Lines, 380, 560, 'Pending / Credit', 'F2', 9);
  addText(p1Lines, 480, 560, 'Expenses', 'F2', 9);

  let yRow = 538;
  for (const m of monthlySeries) {
    addText(p1Lines, 50, yRow, m.month, 'F1', 9);
    addText(p1Lines, 140, yRow, `INR ${m.revenue.toLocaleString('en-IN')}`, 'F1', 9);
    addText(p1Lines, 260, yRow, `INR ${m.collected.toLocaleString('en-IN')}`, 'F1', 9);
    addText(p1Lines, 380, yRow, `INR ${m.pending.toLocaleString('en-IN')}`, 'F1', 9);
    addText(p1Lines, 480, yRow, `INR ${m.expenses.toLocaleString('en-IN')}`, 'F1', 9);
    yRow -= 16;
  }

  // Cash Flow & Receivables Section
  const yCf = yRow - 14;
  addText(p1Lines, 40, yCf, '2. CASH FLOW POSITION & 30-DAY ESTIMATE', 'F2', 11);
  addText(
    p1Lines,
    40,
    yCf - 18,
    `Current Bank Balance: INR ${cashflow.currentBalance.toLocaleString('en-IN')} | 15-Day Est Balance: INR ${cashflow.projectedBalance15d.toLocaleString('en-IN')} | 30-Day Est: INR ${cashflow.projectedBalance30d.toLocaleString('en-IN')}`,
    'F1',
    9
  );
  addText(p1Lines, 40, yCf - 32, `Cashflow Note: ${cashflow.disclaimer}`, 'F1', 8);

  // Outstanding Receivables
  const yCol = yCf - 56;
  addText(p1Lines, 40, yCol, '3. TOP OUTSTANDING RECEIVABLES & COLLECTIONS SCHEDULE', 'F2', 11);
  let yCust = yCol - 18;
  for (const c of collections.slice(0, 4)) {
    addText(
      p1Lines,
      48,
      yCust,
      `#${c.rank} ${c.customerName}: INR ${c.outstandingAmount.toLocaleString('en-IN')} (${c.daysOverdue} days overdue | Priority ${c.priorityScore}/100)`,
      'F1',
      9
    );
    yCust -= 15;
  }

  // Footer Disclaimer on Page 1
  addRect(p1Lines, 40, 45, 515, 42, 0.95);
  addText(p1Lines, 48, 73, 'IMPORTANT DISCLAIMER:', 'F2', 8);
  addText(p1Lines, 48, 61, LOAN_READINESS_DISCLAIMER.slice(0, 105), 'F1', 7.5);
  addText(p1Lines, 48, 51, LOAN_READINESS_DISCLAIMER.slice(105), 'F1', 7.5);

  // --- PAGE 2: Factor Breakdowns, Observations, Recommendations & Mandatory Disclaimer ---
  const p2Lines: string[] = [];
  addRect(p2Lines, 40, 755, 515, 40, 0.94);
  addText(p2Lines, 52, 772, `LOAN READINESS (${loanReadiness.score}/100) & FINANCIAL HEALTH (${financialHealth.score}/100) FACTOR BREAKDOWN`, 'F2', 11);

  let yP2 = 730;
  addText(p2Lines, 40, yP2, '4. LOAN READINESS DETERMINISTIC FACTOR WEIGHTS', 'F2', 10);
  yP2 -= 18;
  for (const f of loanReadiness.factors) {
    addText(
      p2Lines,
      48,
      yP2,
      `- ${f.label} (Weight ${f.weight}%): Score ${f.score}/100 -> +${f.weightedPoints} pts | ${f.reason}`,
      'F1',
      8.5
    );
    yP2 -= 15;
  }

  yP2 -= 10;
  addText(p2Lines, 40, yP2, '5. FINANCIAL HEALTH DETERMINISTIC FACTOR WEIGHTS', 'F2', 10);
  yP2 -= 18;
  for (const f of financialHealth.factors) {
    addText(
      p2Lines,
      48,
      yP2,
      `- ${f.label} (Weight ${f.weight}%): Score ${f.score}/100 -> +${f.weightedPoints} pts | ${f.reason}`,
      'F1',
      8.5
    );
    yP2 -= 15;
  }

  yP2 -= 12;
  addText(p2Lines, 40, yP2, '6. KEY OBSERVATIONS & ACTIONABLE RECOMMENDATIONS TO IMPROVE SCORE', 'F2', 10);
  yP2 -= 18;
  for (const rec of loanReadiness.recommendations) {
    addText(
      p2Lines,
      48,
      yP2,
      `* ${rec.title} (Projected Impact: +${rec.impactPoints} pts) - ${rec.description}`,
      'F1',
      8.5
    );
    yP2 -= 15;
  }

  // Mandatory Disclaimer Box on Page 2
  addRect(p2Lines, 40, 60, 515, 52, 0.94);
  addText(p2Lines, 48, 96, 'MANDATORY REGULATORY & LENDER READINESS DISCLAIMER', 'F2', 8.5);
  addText(p2Lines, 48, 82, LOAN_READINESS_DISCLAIMER.slice(0, 105), 'F1', 8);
  addText(p2Lines, 48, 70, LOAN_READINESS_DISCLAIMER.slice(105), 'F1', 8);

  const stream1 = p1Lines.join('\n');
  const stream2 = p2Lines.join('\n');

  // Assemble PDF 1.4 objects with exact byte offsets
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `7 0 obj\n<< /Length ${stream1.length} >>\nstream\n${stream1}\nendstream\nendobj\n`,
    `8 0 obj\n<< /Length ${stream2.length} >>\nstream\n${stream2}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
