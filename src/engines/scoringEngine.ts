import {
  CASHFLOW_FORECAST_DISCLAIMER,
  LOAN_READINESS_DISCLAIMER,
} from '../i18n/translations.ts';
import type {
  Alert,
  BankTransaction,
  CashflowForecast,
  Customer,
  DuplicateCandidate,
  FinancialHealthBreakdown,
  InventoryItem,
  Invoice,
  LoanReadinessBreakdown,
  MonthlyRevenuePoint,
  Payment,
  Product,
  ProfitLeakageInsight,
  ScoreFactor,
  ScoreRecommendation,
  Shop,
  SupplierPriceInsight,
} from '../types/domain.ts';
import { rankSmartCollections } from './lostMoneyEngine.ts';

export interface ScoringInputData {
  shop: Shop;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  bankTransactions: BankTransaction[];
  duplicates: DuplicateCandidate[];
  monthlySeries: MonthlyRevenuePoint[];
}

export interface WhatIfOptions {
  resolveUnmatched?: boolean;
  collectSeriousOverdue?: boolean;
  recoverDuplicate?: boolean;
  adjustOverpayment?: boolean;
}

export function computeFinancialHealth(data: ScoringInputData): FinancialHealthBreakdown {
  const unmatchedCount = data.bankTransactions.filter(
    (t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  ).length;
  const activeDuplicates = data.duplicates.filter((d) => d.status !== 'dismissed').length;
  const collections = rankSmartCollections(data.customers, data.invoices, data.payments);
  const seriousOverdue = collections
    .filter((c) => c.daysOverdue >= 40)
    .reduce((s, c) => s + c.outstandingAmount, 0);
  const totalReceivables = collections.reduce((s, c) => s + c.outstandingAmount, 0);

  const latestMonth = data.monthlySeries[data.monthlySeries.length - 1] || {
    revenue: 0,
    collected: 0,
    pending: 0,
    expenses: 0,
  };

  const isCleanShop =
    data.invoices.length === 0 &&
    data.bankTransactions.length === 0 &&
    data.customers.length === 0;

  if (isCleanShop) {
    return {
      score: 100,
      status: 'Healthy',
      factors: [
        {
          key: 'revenue_stability',
          label: 'Revenue Stability',
          score: 100,
          weight: 20,
          weightedPoints: 20,
          status: 'positive',
          reason: 'Clean ledger initialized — ready for your first sales bill.',
        },
        {
          key: 'collection_rate',
          label: 'Collection Rate',
          score: 100,
          weight: 20,
          weightedPoints: 20,
          status: 'positive',
          reason: 'No overdue customer balances pending.',
        },
        {
          key: 'expense_trend',
          label: 'Expense & Margin Control',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: 'Zero supplier overpayments or rate leakages.',
        },
        {
          key: 'cashflow_consistency',
          label: 'Cash-Flow Consistency',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: 'Clean cash-flow state.',
        },
        {
          key: 'receivables_ratio',
          label: 'Outstanding Receivables Ratio',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: '₹0 locked in overdue customer udhaar.',
        },
        {
          key: 'payment_discipline',
          label: 'Supplier Payment Discipline',
          score: 100,
          weight: 10,
          weightedPoints: 10,
          status: 'positive',
          reason: 'Zero duplicate supplier payments.',
        },
        {
          key: 'record_completeness',
          label: 'Record Completeness',
          score: 100,
          weight: 5,
          weightedPoints: 5,
          status: 'positive',
          reason: 'Zero unmatched bank statement entries.',
        },
      ],
      summaryText:
        'Aapki dukan ka Hisab Kitab bilkul saaf (0 demo data) hai. Voice Billing ya Bill Scanner se apna pehla bill banayein, ya Cross-Check Statement & Bill se bank statement milayein.',
    };
  }

  const collectionRatio = latestMonth.revenue > 0 ? latestMonth.collected / latestMonth.revenue : 1;

  // 1. Revenue Stability (weight 20)
  const revScore = data.monthlySeries.length >= 4 && latestMonth.revenue >= 350000 ? 85 : 75;
  // 2. Collection Rate (weight 20)
  const colScore = collectionRatio >= 0.85 ? 80 : Math.max(50, Math.round(collectionRatio * 95));
  // 3. Expense Trend (weight 15)
  const expScore = latestMonth.expenses <= latestMonth.revenue * 0.75 ? 80 : 65;
  // 4. Cash-flow Consistency (weight 15)
  const cfScore = seriousOverdue > 35000 ? 74 : 84;
  // 5. Outstanding Receivables Ratio (weight 15)
  const recScore = totalReceivables > 60000 ? 66 : totalReceivables > 30000 ? 78 : 90;
  // 6. Payment Discipline (weight 10)
  const discScore = Math.max(45, 90 - activeDuplicates * 15);
  // 7. Record Completeness (weight 5)
  const compScore = Math.max(50, 99 - unmatchedCount * 3);

  const factors: ScoreFactor[] = [
    {
      key: 'revenue_stability',
      label: 'Revenue Stability',
      score: revScore,
      weight: 20,
      weightedPoints: Number((revScore * 0.2).toFixed(1)),
      status: revScore >= 80 ? 'positive' : 'caution',
      reason: `Steady monthly sales around ₹${(latestMonth.revenue / 100000).toFixed(1)}L across recent months.`,
    },
    {
      key: 'collection_rate',
      label: 'Collection Rate',
      score: colScore,
      weight: 20,
      weightedPoints: Number((colScore * 0.2).toFixed(1)),
      status: colScore >= 80 ? 'positive' : 'caution',
      reason: `${Math.round(collectionRatio * 100)}% of recent billed revenue collected on time.`,
    },
    {
      key: 'expense_trend',
      label: 'Expense & Margin Control',
      score: expScore,
      weight: 15,
      weightedPoints: Number((expScore * 0.15).toFixed(1)),
      status: expScore >= 75 ? 'positive' : 'caution',
      reason: `Operating purchases within healthy band, though rice supplier rate has a ₹4/kg gap.`,
    },
    {
      key: 'cashflow_consistency',
      label: 'Cash-Flow Consistency',
      score: cfScore,
      weight: 15,
      weightedPoints: Number((cfScore * 0.15).toFixed(1)),
      status: cfScore >= 80 ? 'positive' : 'caution',
      reason: `Slight mid-month cash-flow dip due to delayed credit recoveries.`,
    },
    {
      key: 'receivables_ratio',
      label: 'Outstanding Receivables Ratio',
      score: recScore,
      weight: 15,
      weightedPoints: Number((recScore * 0.15).toFixed(1)),
      status: recScore >= 75 ? 'positive' : 'caution',
      reason: `₹${totalReceivables.toLocaleString('en-IN')} locked in customer khata (including ₹${seriousOverdue.toLocaleString('en-IN')} > 40 days).`,
    },
    {
      key: 'payment_discipline',
      label: 'Supplier Payment Discipline',
      score: discScore,
      weight: 10,
      weightedPoints: Number((discScore * 0.1).toFixed(1)),
      status: discScore >= 80 ? 'positive' : 'caution',
      reason:
        activeDuplicates > 0
          ? `${activeDuplicates} possible duplicate supplier payment (₹18,500) detected.`
          : 'All supplier payments verified against purchase bills.',
    },
    {
      key: 'record_completeness',
      label: 'Record Completeness',
      score: compScore,
      weight: 5,
      weightedPoints: Number((compScore * 0.05).toFixed(1)),
      status: compScore >= 85 ? 'positive' : 'caution',
      reason:
        unmatchedCount > 0
          ? `${unmatchedCount} bank transactions awaiting bill confirmation.`
          : '100% of bank statement entries matched.',
    },
  ];

  const totalScore = Math.round(factors.reduce((sum, f) => sum + f.weightedPoints, 0));
  const status = totalScore >= 75 ? 'Healthy' : totalScore >= 55 ? 'Needs attention' : 'At risk';

  return {
    score: totalScore,
    status,
    factors,
    summaryText: `Aapka Financial Health score ${totalScore}/100 (${status}) hai. Sales aur collection acchi hai, lekin ₹${seriousOverdue.toLocaleString('en-IN')} ka purana udhaar aur duplicate payment recover karne se score 86+ ho sakta hai.`,
  };
}

export function computeLoanReadiness(
  data: ScoringInputData,
  whatIf: WhatIfOptions = {}
): LoanReadinessBreakdown {
  const rawUnmatched = data.bankTransactions.filter(
    (t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  ).length;
  const unmatchedCount = whatIf.resolveUnmatched ? 0 : rawUnmatched;

  const rawDuplicates = data.duplicates.filter((d) => d.status !== 'dismissed').length;
  const duplicateCount = whatIf.recoverDuplicate ? 0 : rawDuplicates;

  const collections = rankSmartCollections(data.customers, data.invoices, data.payments);
  const rawSeriousOverdue = collections
    .filter((c) => c.daysOverdue >= 40)
    .reduce((s, c) => s + c.outstandingAmount, 0);
  const seriousOverdue = whatIf.collectSeriousOverdue ? 0 : rawSeriousOverdue;

  const hasOverpayment = whatIf.adjustOverpayment
    ? false
    : data.invoices.some((i) => i.status === 'overpaid');

  const isCleanShop =
    data.invoices.length === 0 &&
    data.bankTransactions.length === 0 &&
    data.customers.length === 0;

  if (isCleanShop) {
    return {
      score: 100,
      status: 'Ready for MSME Credit',
      factors: [
        {
          key: 'revenue_consistency',
          label: 'Revenue Consistency',
          score: 100,
          weight: 20,
          weightedPoints: 20,
          status: 'positive',
          reason: 'Clean ledger ready to record sales and GST bills.',
        },
        {
          key: 'cashflow_consistency',
          label: 'Cash-Flow Consistency',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: 'No cash-flow deficits recorded.',
        },
        {
          key: 'record_completeness',
          label: 'Book & Invoice Completeness',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: 'All bills and bank records are in sync.',
        },
        {
          key: 'outstanding_invoices',
          label: 'Overdue Receivables Exposure',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: '₹0 overdue customer receivables.',
        },
        {
          key: 'unmatched_transactions',
          label: 'Bank Statement Reconciliation',
          score: 100,
          weight: 15,
          weightedPoints: 15,
          status: 'positive',
          reason: '0 unmatched bank statement entries.',
        },
        {
          key: 'duplicate_payments',
          label: 'Duplicate Payment Controls',
          score: 100,
          weight: 10,
          weightedPoints: 10,
          status: 'positive',
          reason: 'Zero duplicate supplier payments.',
        },
        {
          key: 'vintage_and_expenses',
          label: 'Business Vintage & Expense Patterns',
          score: 100,
          weight: 10,
          weightedPoints: 10,
          status: 'positive',
          reason: 'Clean shop profile.',
        },
      ],
      whyBullets: [
        {
          type: 'positive',
          text: '✅ Clean shop ledger — zero unmatched bank transactions or overdue bills',
        },
      ],
      recommendations: [],
      disclaimer: LOAN_READINESS_DISCLAIMER,
    };
  }

  // 1. Revenue Consistency (weight 20) -> 85 * 0.20 = 17.0
  const revScore = 85;
  // 2. Cash-flow Consistency (weight 15) -> 72 * 0.15 = 10.8 (or 85 if overpayment & overdue resolved)
  const cfScore = whatIf.collectSeriousOverdue ? 80 : 72;
  // 3. Record Completeness (weight 15) -> 76 * 0.15 = 11.4 (or 96 if unmatched & overpayment fixed)
  const recCompScore = (whatIf.resolveUnmatched ? 84 : 76) + (whatIf.adjustOverpayment ? 12 : 0);
  // 4. Outstanding Invoices (weight 15) -> 60 * 0.15 = 9.0 (or 88 if collected)
  const outInvScore = seriousOverdue > 30000 ? 60 : 88;
  // 5. Unmatched Transactions (weight 15) -> (100 - 3*16 = 52) * 0.15 = 7.8 (or 92 if resolved -> +6 pts)
  const unmScore = unmatchedCount === 0 ? 92 : Math.max(20, 100 - unmatchedCount * 16);
  // 6. Duplicate Payments (weight 10) -> 70 * 0.10 = 7.0 (or 100 if recovered -> +3 pts)
  const dupScore = duplicateCount === 0 ? 100 : Math.max(30, 100 - duplicateCount * 30);
  // 7. Business Vintage & Expense Discipline (weight 10) -> 90 * 0.10 = 9.0 (or 100 if overpayment adjusted)
  const vinScore = hasOverpayment ? 90 : 100;

  const factors: ScoreFactor[] = [
    {
      key: 'revenue_consistency',
      label: 'Revenue Consistency',
      score: revScore,
      weight: 20,
      weightedPoints: Number((revScore * 0.2).toFixed(1)),
      status: 'positive',
      reason: '6-month documented turnover averaging ₹3.95L–₹4.20L/month.',
    },
    {
      key: 'cashflow_consistency',
      label: 'Cash-Flow Consistency',
      score: cfScore,
      weight: 15,
      weightedPoints: Number((cfScore * 0.15).toFixed(1)),
      status: cfScore >= 80 ? 'positive' : 'caution',
      reason: 'Inconsistent monthly net inflow due to 45-day delayed wholesale collections.',
    },
    {
      key: 'record_completeness',
      label: 'Book & Invoice Completeness',
      score: recCompScore,
      weight: 15,
      weightedPoints: Number((recCompScore * 0.15).toFixed(1)),
      status: recCompScore >= 80 ? 'positive' : 'caution',
      reason: 'Most GST sales and purchase bills digitized; minor supplier variance present.',
    },
    {
      key: 'outstanding_invoices',
      label: 'Overdue Receivables Exposure',
      score: outInvScore,
      weight: 15,
      weightedPoints: Number((outInvScore * 0.15).toFixed(1)),
      status: outInvScore >= 80 ? 'positive' : 'caution',
      reason:
        seriousOverdue > 0
          ? `₹${seriousOverdue.toLocaleString('en-IN')} overdue > 40 days (Rahul Sharma) impacts working capital turnover.`
          : 'Overdue receivables within healthy 30-day cycle.',
    },
    {
      key: 'unmatched_transactions',
      label: 'Bank Statement Reconciliation',
      score: unmScore,
      weight: 15,
      weightedPoints: Number((unmScore * 0.15).toFixed(1)),
      status: unmScore >= 80 ? 'positive' : 'negative',
      reason:
        unmatchedCount > 0
          ? `${unmatchedCount} unmatched bank transactions lack linked bills.`
          : 'All bank statement entries matched with bills.',
    },
    {
      key: 'duplicate_payments',
      label: 'Duplicate Payment Controls',
      score: dupScore,
      weight: 10,
      weightedPoints: Number((dupScore * 0.1).toFixed(1)),
      status: dupScore >= 90 ? 'positive' : 'caution',
      reason:
        duplicateCount > 0
          ? `${duplicateCount} possible duplicate payment (₹18,500 to Gupta Traders) flagged.`
          : 'Zero unverified duplicate outflows.',
    },
    {
      key: 'vintage_and_expenses',
      label: 'Business Vintage & Expense Patterns',
      score: vinScore,
      weight: 10,
      weightedPoints: Number((vinScore * 0.1).toFixed(1)),
      status: 'positive',
      reason: `${data.shop.vintageMonths} months operational history with active GSTIN & supplier ledger.`,
    },
  ];

  const totalScore = Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.weightedPoints, 0)));

  const whyBullets: LoanReadinessBreakdown['whyBullets'] = [];
  if (unmatchedCount > 0) {
    whyBullets.push({
      type: 'negative',
      text: `❌ ${unmatchedCount} unmatched payments in bank statement`,
    });
  }
  if (seriousOverdue > 0) {
    whyBullets.push({
      type: 'caution',
      text: `⚠️ ₹${seriousOverdue.toLocaleString('en-IN')} outstanding overdue > 40 days (Rahul Sharma)`,
    });
  }
  whyBullets.push({
    type: 'caution',
    text: '⚠️ Inconsistent monthly cash flow during mid-month restocking',
  });
  if (duplicateCount > 0) {
    whyBullets.push({
      type: 'caution',
      text: `⚠️ ${duplicateCount} possible duplicate payment of ₹18,500 needs vendor adjustment`,
    });
  }
  whyBullets.push({
    type: 'positive',
    text: '✅ Strong ₹4.2L monthly revenue & 88% collection track record',
  });

  const recommendations: ScoreRecommendation[] = [
    {
      id: 'resolveUnmatched',
      title: `Resolve ${rawUnmatched || 3} unmatched payments in Payment Inbox`,
      description: 'Link or categorize the 3 unverified bank entries so lenders see 100% reconciled books.',
      impactPoints: 7,
      actionRoute: '/payments/inbox',
    },
    {
      id: 'collectSeriousOverdue',
      title: 'Collect ₹42,000 overdue from Rahul Sharma',
      description: 'Recovering 45-day overdue receivables improves working capital ratio and cash-flow consistency.',
      impactPoints: 5,
      actionRoute: '/customers/cust-rahul',
    },
    {
      id: 'recoverDuplicate',
      title: 'Confirm & recover ₹18,500 duplicate payment from Gupta Traders',
      description: 'Record vendor credit note or refund for the duplicate UPI/NEFT debit.',
      impactPoints: 3,
      actionRoute: '/reconciliation',
    },
    {
      id: 'adjustOverpayment',
      title: 'Reconcile ₹7,000 excess supplier payment (Shree Balaji Hardware)',
      description: 'Attach credit note for the ₹7,000 overpayment on Bill SBH-118.',
      impactPoints: 3,
      actionRoute: '/lost-money',
    },
  ];

  const status =
    totalScore >= 80
      ? 'Ready for MSME Credit'
      : totalScore >= 65
        ? 'Nearly Ready — Fix Key Gaps'
        : 'Needs Record Cleanup';

  return {
    score: totalScore,
    status,
    factors,
    whyBullets,
    recommendations,
    disclaimer: LOAN_READINESS_DISCLAIMER,
  };
}

export function computeCashflowForecast(data: ScoringInputData): CashflowForecast {
  const isCleanShop =
    data.invoices.length === 0 &&
    data.bankTransactions.length === 0 &&
    data.customers.length === 0;

  const latestTxn = [...data.bankTransactions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const currentBalance =
    latestTxn?.balance ?? data.shop.openingBankBalance ?? (data.shop.demoMode ? 142500 : 0);

  const collections = rankSmartCollections(data.customers, data.invoices, data.payments);
  const expectedCollections15d = isCleanShop
    ? 0
    : Math.round(
        collections.reduce((sum, c) => sum + c.outstandingAmount * c.promisesKeptRatio * 0.55, 0) +
          (data.shop.demoMode ? 165000 : 0)
      );
  const expectedExpenses15d = isCleanShop ? 0 : data.shop.demoMode ? 198000 : 0;
  const projectedBalance15d = currentBalance + expectedCollections15d - expectedExpenses15d;

  const expectedCollections30d = Math.round(expectedCollections15d * 2.1);
  const expectedExpenses30d = isCleanShop ? 0 : data.shop.demoMode ? 365000 : 0;
  const projectedBalance30d = currentBalance + expectedCollections30d - expectedExpenses30d;

  const riskLevel: CashflowForecast['riskLevel'] =
    isCleanShop ? 'Low' : projectedBalance15d < 60000 ? 'High' : 'Moderate';

  const points15d = [
    { dayLabel: 'Today', date: '2026-04-28', projectedBalance: currentBalance, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 3', date: '2026-05-01', projectedBalance: currentBalance, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 6', date: '2026-05-04', projectedBalance: currentBalance, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 9', date: '2026-05-07', projectedBalance: currentBalance, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 12', date: '2026-05-10', projectedBalance: currentBalance, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 15', date: '2026-05-13', projectedBalance: projectedBalance15d, inflow: 0, outflow: 0 },
  ];

  const points30d = [
    ...points15d,
    { dayLabel: 'Day 20', date: '2026-05-18', projectedBalance: projectedBalance15d, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 25', date: '2026-05-23', projectedBalance: projectedBalance15d, inflow: 0, outflow: 0 },
    { dayLabel: 'Day 30', date: '2026-05-28', projectedBalance: projectedBalance30d, inflow: 0, outflow: 0 },
  ];

  return {
    currentBalance,
    expectedCollections15d,
    expectedExpenses15d,
    projectedBalance15d,
    expectedCollections30d,
    expectedExpenses30d,
    projectedBalance30d,
    riskLevel,
    advisoryMessage: isCleanShop
      ? 'Aapki dukan ka khata saaf hai. Jaise hi aap bills aur bank statements add karenge, Hisab Kitab 15-30 din ka cashflow forecast dikhayega.'
      : `Current trend ke according agle 15 din mein expected collection ₹${expectedCollections15d.toLocaleString('en-IN')} hai.`,
    disclaimer: CASHFLOW_FORECAST_DISCLAIMER,
    points15d,
    points30d,
  };
}

export function computeSupplierPriceIntelligence(products: Product[]): SupplierPriceInsight[] {
  const insights: SupplierPriceInsight[] = [];

  for (const prod of products) {
    if (!prod.supplierQuotes || prod.supplierQuotes.length < 2) continue;
    const sorted = [...prod.supplierQuotes].sort((a, b) => b.pricePerUnit - a.pricePerUnit);
    const highest = sorted[0];
    const cheapest = sorted[sorted.length - 1];
    const gap = highest.pricePerUnit - cheapest.pricePerUnit;
    if (gap <= 0) continue;

    const monthlyVol = prod.monthlyVolumeEst || 800;
    const estimatedMonthlySaving = Math.round(gap * monthlyVol);

    insights.push({
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      currentSupplierName: highest.supplierName,
      currentPrice: highest.pricePerUnit,
      cheapestSupplierName: cheapest.supplierName,
      cheapestPrice: cheapest.pricePerUnit,
      priceGapPerUnit: gap,
      monthlyVolume: monthlyVol,
      estimatedMonthlySaving,
      historicalTrend: [
        { month: 'Jan', supplierA: highest.pricePerUnit - 2, supplierB: cheapest.pricePerUnit - 1 },
        { month: 'Feb', supplierA: highest.pricePerUnit - 1, supplierB: cheapest.pricePerUnit },
        { month: 'Mar', supplierA: highest.pricePerUnit, supplierB: cheapest.pricePerUnit },
        { month: 'Apr', supplierA: highest.pricePerUnit, supplierB: cheapest.pricePerUnit },
      ],
      explanation: `Aap same product (${prod.name}) ke liye ${highest.supplierName} ko ₹${gap}/${prod.unit} extra pay kar rahe hain vs ${cheapest.supplierName}.`,
    });
  }

  return insights;
}

export function computeProfitLeakage(
  data: ScoringInputData,
  supplierInsights: SupplierPriceInsight[]
): ProfitLeakageInsight[] {
  const insights: ProfitLeakageInsight[] = [];

  if (data.duplicates.length > 0) {
    // 1. Causal Margin Explanation when duplicates exist
    insights.push({
      id: 'leak-margin-causal',
      type: 'margin_compression',
      title: 'Duplicate payments aur overpayments se margin impact ho raha hai',
      monthlyImpact: data.duplicates.reduce((s, d) => s + d.recoverableAmount, 0),
      causalExplanation:
        'Duplicate supplier payment aur unverified entries ki wajah se working capital aur margin par asar pad raha hai.',
      recommendation:
        'Duplicate payment aur overpayment ka credit note lein.',
      actionRoute: '/lost-money',
    });
  }

  for (const sp of supplierInsights) {
    insights.push({
      id: `leak-sup-${sp.productId}`,
      type: 'supplier_price',
      title: `${sp.explanation}`,
      monthlyImpact: sp.estimatedMonthlySaving,
      causalExplanation: `${sp.currentSupplierName} charges ₹${sp.currentPrice}/${sp.unit} while ${sp.cheapestSupplierName} supplies the same grade at ₹${sp.cheapestPrice}/${sp.unit}.`,
      recommendation: `Switch or renegotiate ${sp.productName} rate to save ₹${sp.estimatedMonthlySaving.toLocaleString('en-IN')}/month.`,
      actionRoute: '/suppliers',
    });
  }

  return insights;
}

export function generateSystemAlerts(
  shopId: string,
  duplicates: DuplicateCandidate[],
  customers: Customer[],
  invoices: Invoice[],
  payments: Payment[],
  bankTransactions: BankTransaction[],
  inventory: InventoryItem[],
  products: Product[],
  existingStatuses: Record<string, 'new' | 'seen' | 'resolved' | 'dismissed'> = {}
): Alert[] {
  const alerts: Alert[] = [];
  const now = '2026-04-28T09:30:00.000Z';

  // 1. Duplicate payments
  for (const dup of duplicates) {
    const id = `alert-dup-${dup.id}`;
    alerts.push({
      id,
      shopId,
      type: 'duplicate_payment',
      severity: 'critical',
      title: `Possible duplicate payment of ₹${dup.amount.toLocaleString('en-IN')} to ${dup.counterpartyName}`,
      body: `Do baar ₹${dup.amount.toLocaleString('en-IN')} debit hua hai (${dup.daysApart} din ke andar). Confirm karke refund ya credit note maangein.`,
      entityRef: dup.id,
      actionRoute: '/reconciliation',
      amountAtStake: dup.recoverableAmount,
      status: existingStatuses[id] || 'new',
      createdAt: now,
    });
  }

  // 2. Overdue collections
  const collections = rankSmartCollections(customers, invoices, payments);
  for (const col of collections.slice(0, 2)) {
    const id = `alert-col-${col.customerId}`;
    alerts.push({
      id,
      shopId,
      type: 'overdue_collection',
      severity: col.daysOverdue >= 40 ? 'critical' : 'high',
      title: `${col.customerName} se ₹${col.outstandingAmount.toLocaleString('en-IN')} lena baaki (${col.daysOverdue} days overdue)`,
      body: `Aapko abhi ₹${col.outstandingAmount.toLocaleString('en-IN')} lena hai. Smart WhatsApp reminder bhejein.`,
      entityRef: col.customerId,
      actionRoute: `/customers/${col.customerId}`,
      amountAtStake: col.outstandingAmount,
      status: existingStatuses[id] || 'new',
      createdAt: now,
    });
  }

  // 3. Supplier overpayment
  const overpaidInv = invoices.find((i) => i.status === 'overpaid');
  if (overpaidInv) {
    const excess = overpaidInv.paidAmount - overpaidInv.total;
    const id = `alert-over-${overpaidInv.id}`;
    alerts.push({
      id,
      shopId,
      type: 'overpayment',
      severity: 'high',
      title: `Overpayment of ₹${excess.toLocaleString('en-IN')} to ${overpaidInv.supplierName || 'Supplier'}`,
      body: `Bill ${overpaidInv.billNumber || overpaidInv.invoiceNumber} ₹${overpaidInv.total.toLocaleString('en-IN')} ka tha, lekin ₹${overpaidInv.paidAmount.toLocaleString('en-IN')} pay hua.`,
      entityRef: overpaidInv.id,
      actionRoute: '/lost-money',
      amountAtStake: excess,
      status: existingStatuses[id] || 'new',
      createdAt: now,
    });
  }

  // 4. Unmatched bank transactions
  const unmatchedTxns = bankTransactions.filter(
    (t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  );
  if (unmatchedTxns.length > 0) {
    const sum = unmatchedTxns.reduce((s, t) => s + t.amount, 0);
    const id = 'alert-unmatched-inbox';
    alerts.push({
      id,
      shopId,
      type: 'unmatched_payment',
      severity: 'medium',
      title: `${unmatchedTxns.length} bank payments kisi bill se match nahi ho rahi`,
      body: `Payment Inbox mein ${unmatchedTxns.length} entries (₹${sum.toLocaleString('en-IN')}) confirm karne se Loan Readiness +7 badhega.`,
      actionRoute: '/payments/inbox',
      amountAtStake: sum,
      status: existingStatuses[id] || 'new',
      createdAt: now,
    });
  }

  // 6. Low stock items
  const lowStockItems = inventory.filter((item) => item.quantity <= item.reorderLevel);
  if (lowStockItems.length > 0) {
    const names = lowStockItems
      .map((item) => products.find((p) => p.id === item.productId)?.name || 'Item')
      .join(', ');
    const id = 'alert-low-stock';
    alerts.push({
      id,
      shopId,
      type: 'low_stock',
      severity: 'low',
      title: `${lowStockItems.length} items low stock mein hain (${names})`,
      body: `Inventory check karein aur saste supplier se reorder lagayein.`,
      actionRoute: '/inventory',
      status: existingStatuses[id] || 'new',
      createdAt: now,
    });
  }

  const severityOrder: Record<Alert['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return alerts.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      (b.amountAtStake || 0) - (a.amountAtStake || 0)
  );
}
