export type Language = 'hinglish' | 'en' | 'hi';

export type PlanTier = 'free' | 'pro' | 'business';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  language: Language;
  createdAt: string;
}

export interface Shop {
  id: string;
  ownerUserId: string;
  shopName: string;
  ownerName: string;
  mobile: string;
  email: string;
  address: string;
  businessType: 'kirana' | 'hardware' | 'medical' | 'clothing' | 'mobile' | 'restaurant' | 'trader' | 'service';
  logoUrl?: string;
  gstin?: string;
  vintageMonths: number;
  plan: PlanTier;
  demoMode: boolean;
  openingBankBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  openingBalance: number; // positive = customer owes shop
  averageDelayDays: number;
  promisesKeptRatio: number; // 0 to 1
  relationshipValue: 'high' | 'medium' | 'normal';
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  contact: string;
  gstin?: string;
  notes?: string;
  openingBalance: number; // positive = shop owes supplier
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  sku?: string;
  unit: 'kg' | 'g' | 'pcs' | 'litre' | 'box' | 'bag';
  costPrice: number;
  sellingPrice: number;
  category: string;
  monthlyVolumeEst?: number;
  supplierQuotes?: Array<{
    supplierId: string;
    supplierName: string;
    pricePerUnit: number;
    lastUpdated: string;
  }>;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  shopId: string;
  productId: string;
  quantity: number;
  reorderLevel: number;
  stockValue: number;
  velocity: 'fast' | 'normal' | 'slow';
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  shopId: string;
  productId: string;
  delta: number;
  reason: 'invoice' | 'purchase' | 'adjustment';
  refId?: string;
  createdAt: string;
}

export type InvoiceStatus =
  | 'paid'
  | 'unpaid'
  | 'partial'
  | 'short'
  | 'overpaid'
  | 'unknown'
  | 'duplicate';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  shopId: string;
  productId?: string;
  name: string;
  quantity: number;
  unit: string;
  weight?: string;
  unitPrice: number;
  discount: number;
  gstRate: number;
  lineTotal: number;
  confidence?: number;
}

export interface Invoice {
  id: string;
  shopId: string;
  type: 'sale' | 'purchase';
  invoiceNumber: string;
  billNumber?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  status: InvoiceStatus;
  paidAmount: number;
  source: 'manual' | 'voice' | 'scan' | 'import';
  sourceFileUrl?: string;
  ocrConfidence?: number;
  fieldConfidences?: Record<string, number>;
  items: InvoiceItem[];
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  shopId: string;
  direction: 'in' | 'out';
  partyType: 'customer' | 'supplier' | 'expense' | 'unknown';
  partyId?: string;
  partyName?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method: 'cash' | 'UPI' | 'bank' | 'cheque';
  reference?: string;
  notes?: string;
  source: 'manual' | 'voice' | 'bank_statement' | 'scan';
  invoiceId?: string;
  bankTransactionId?: string;
  isDemo?: boolean;
  createdAt: string;
}

export interface BankStatement {
  id: string;
  shopId: string;
  fileUrl?: string;
  fileName: string;
  format: 'csv' | 'xlsx' | 'pdf';
  periodStart: string;
  periodEnd: string;
  status: 'parsed' | 'reconciled' | 'failed';
  parsedCount: number;
  createdAt: string;
}

export type BankMatchStatus =
  | 'matched'
  | 'possible'
  | 'unmatched'
  | 'duplicate'
  | 'overpaid'
  | 'short'
  | 'partial';

export interface BankTransaction {
  id: string;
  shopId: string;
  statementId: string;
  date: string; // YYYY-MM-DD
  description: string;
  debit: number;
  credit: number;
  amount: number; // positive magnitude
  direction: 'in' | 'out';
  balance: number;
  txnId?: string;
  reference?: string;
  counterpartyName?: string;
  normalizedHash: string;
  matchStatus: BankMatchStatus;
  linkedInvoiceId?: string;
  createdAt: string;
}

export interface MatchSignalReason {
  signal: string;
  label: string;
  matched: boolean;
  weight: number;
  earned: number;
  detail: string;
}

export interface MatchAlternative {
  invoiceId: string;
  invoiceNumber: string;
  partyName: string;
  invoiceTotal: number;
  issueDate: string;
  confidence: number;
  summaryReason: string;
}

export interface ReconciliationMatch {
  id: string;
  shopId: string;
  bankTransactionId: string;
  invoiceId?: string;
  confidence: number; // 0-100
  status: 'auto_confirmed' | 'suggested' | 'user_confirmed' | 'rejected' | 'unmatched';
  derivedStatus: InvoiceStatus;
  reasons: MatchSignalReason[];
  alternatives: MatchAlternative[];
  createdAt: string;
  confirmedBy?: string;
}

export interface DuplicateCandidate {
  id: string;
  shopId: string;
  primaryTxnId: string;
  duplicateTxnId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  counterpartyName: string;
  amount: number;
  recoverableAmount: number;
  confidence: number;
  daysApart: number;
  status: 'possible' | 'confirmed' | 'dismissed' | 'reminded_later';
  evidence: string[];
  vendorDraftMessage: string;
}

export interface LostMoneyItem {
  id: string;
  category:
    | 'duplicate_payment'
    | 'pending_collection'
    | 'overpayment'
    | 'short_payment'
    | 'unmatched_payment'
    | 'supplier_price_gap';
  bucket: 'hero_high_priority' | 'follow_up';
  outcomePillar: 'SAVE' | 'GET' | 'READY';
  title: string;
  partyName: string;
  partyId?: string;
  entityId?: string;
  amount: number;
  confidence: number;
  isConfirmed: boolean;
  daysOverdue?: number;
  evidence: string[];
  recommendedAction: string;
  actionRoute: string;
  actionType: 'confirm_duplicate' | 'send_reminder' | 'request_credit_note' | 'review_inbox' | 'switch_supplier';
}

export interface LostMoneySummary {
  heroRecoveryTotal: number; // ₹67,500 on demo seed
  duplicatePaymentsTotal: number; // ₹18,500
  overdueCollectionsHeroTotal: number; // ₹42,000
  overpaymentTotal: number; // ₹7,000
  followUpReceivablesTotal: number; // ₹25,700 (Amit ₹18,500 + Raj ₹7,200)
  unmatchedPaymentsTotal: number;
  supplierMonthlySavingsEst: number;
  items: LostMoneyItem[];
}

export interface CollectFirstItem {
  rank: number;
  customerId: string;
  customerName: string;
  mobile?: string;
  outstandingAmount: number;
  daysOverdue: number;
  priorityScore: number;
  tier: 'critical_recovery' | 'follow_up';
  reason: string;
  averageDelayDays: number;
  promisesKeptRatio: number;
  invoiceIds: string[];
}

export interface Alert {
  id: string;
  shopId: string;
  type:
    | 'duplicate_payment'
    | 'overdue_collection'
    | 'low_stock'
    | 'loan_readiness_drop'
    | 'collection_opportunity'
    | 'revenue_growth'
    | 'unmatched_payment'
    | 'overpayment'
    | 'supplier_price';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  body: string;
  entityRef?: string;
  actionRoute: string;
  amountAtStake?: number;
  status: 'new' | 'seen' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface Reminder {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  invoiceId?: string;
  amount: number;
  daysOverdue: number;
  channel: 'whatsapp' | 'sms' | 'email';
  tone: 'polite' | 'firm' | 'final';
  draftText: string;
  status: 'draft' | 'copied' | 'marked_sent';
  createdAt: string;
}

export interface ScoreFactor {
  key: string;
  label: string;
  score: number; // 0-100 for this factor
  weight: number; // percentage weight summing to 100
  weightedPoints: number;
  status: 'positive' | 'caution' | 'negative';
  reason: string;
}

export interface ScoreRecommendation {
  id: string;
  title: string;
  description: string;
  impactPoints: number;
  actionRoute: string;
}

export interface FinancialHealthBreakdown {
  score: number; // 78 on demo seed
  status: 'Healthy' | 'Needs attention' | 'At risk';
  factors: ScoreFactor[];
  summaryText: string;
}

export interface LoanReadinessBreakdown {
  score: number; // 72 on demo seed
  status: 'Ready for MSME Credit' | 'Nearly Ready — Fix Key Gaps' | 'Needs Record Cleanup';
  factors: ScoreFactor[];
  whyBullets: Array<{
    type: 'negative' | 'caution' | 'positive';
    text: string;
  }>;
  recommendations: ScoreRecommendation[];
  disclaimer: string;
}

export interface ScoreSnapshot {
  id: string;
  shopId: string;
  kind: 'financial_health' | 'loan_readiness';
  score: number;
  periodLabel: string;
  factors: ScoreFactor[];
  createdAt: string;
}

export interface CashflowForecastPoint {
  dayLabel: string;
  date: string;
  projectedBalance: number;
  inflow: number;
  outflow: number;
}

export interface CashflowForecast {
  currentBalance: number;
  expectedCollections15d: number;
  expectedExpenses15d: number;
  projectedBalance15d: number;
  expectedCollections30d: number;
  expectedExpenses30d: number;
  projectedBalance30d: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  advisoryMessage: string;
  disclaimer: string;
  points15d: CashflowForecastPoint[];
  points30d: CashflowForecastPoint[];
}

export interface SupplierPriceInsight {
  productId: string;
  productName: string;
  unit: string;
  currentSupplierName: string;
  currentPrice: number;
  cheapestSupplierName: string;
  cheapestPrice: number;
  priceGapPerUnit: number;
  monthlyVolume: number;
  estimatedMonthlySaving: number;
  historicalTrend: Array<{ month: string; supplierA: number; supplierB: number }>;
  explanation: string;
}

export interface ProfitLeakageInsight {
  id: string;
  type: 'supplier_price' | 'duplicate_payment' | 'uncollected_receivables' | 'overpayment' | 'margin_compression';
  title: string;
  monthlyImpact: number;
  causalExplanation: string;
  recommendation: string;
  actionRoute: string;
}

export interface AiToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  resultSummary: string;
}

export interface AiActionProposal {
  id: string;
  type: 'add_payment' | 'create_invoice' | 'create_reminder';
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface AiMessage {
  id: string;
  shopId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AiToolCallRecord[];
  actionProposal?: AiActionProposal;
  structuredCard?: {
    type: 'customer_khata' | 'reminder_draft' | 'ranked_problems' | 'invoice_preview';
    data: Record<string, unknown>;
  };
  createdAt: string;
}

export interface ParsedVoiceCommand {
  intent:
    | 'create_bill'
    | 'credit_sale'
    | 'payment_received'
    | 'cash_sale'
    | 'supplier_payment'
    | 'multimodal_assign'
    | 'unknown';
  rawTranscript: string;
  partyName?: string;
  matchedParties: Array<{ id: string; name: string; type: 'customer' | 'supplier'; mobile?: string }>;
  isAmbiguousParty: boolean;
  isNewParty: boolean;
  items: Array<{
    name: string;
    productId?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  totalAmount: number;
  paymentMethod?: 'cash' | 'UPI' | 'bank';
  confidence: number;
  explanation: string;
}

export interface ParsedBillScan {
  billNumber: string;
  invoiceNumber: string;
  invoiceType: 'sale' | 'purchase';
  partyName: string;
  partyType: 'customer' | 'supplier';
  partyGstin?: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  overallConfidence: number;
  fieldConfidences: {
    invoiceNumber: number;
    partyName: number;
    issueDate: number;
    total: number;
    gstAmount: number;
    items: number;
  };
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    weight?: string;
    unitPrice: number;
    discount: number;
    gstRate: number;
    lineTotal: number;
    confidence: number;
  }>;
  voiceInstruction?: {
    rawText: string;
    targetCustomerName?: string;
    matchedCustomers: Array<{ id: string; name: string; mobile?: string }>;
    isAmbiguousCustomer: boolean;
    action: 'add_to_khata' | 'mark_paid' | 'save_purchase';
  };
  lowConfidenceFields: string[];
  providerUsed: 'gemini' | 'demo';
}

export interface MonthlyRevenuePoint {
  month: string; // e.g., "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"
  revenue: number;
  collected: number;
  pending: number;
  expenses: number;
}
