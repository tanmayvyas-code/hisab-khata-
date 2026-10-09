import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Mic,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import ownerAvatarImg from '../assets/images/avatar_shop_owner_1791498781755.jpg';
import {
  Alert,
  BankTransaction,
  CollectFirstItem,
  DuplicateCandidate,
  FinancialHealthBreakdown,
  InventoryItem,
  Invoice,
  Language,
  LoanReadinessBreakdown,
  LostMoneySummary,
  MonthlyRevenuePoint,
  Product,
  Shop,
} from '../types/domain';
import {
  formatINR,
  formatINRCompact,
  LOAN_READINESS_DISCLAIMER,
  UI_DICT,
} from '../i18n/translations';
import { ScoreRing } from './ui';

export const DashboardPage: React.FC<{
  language: Language;
  shop: Shop;
  health: FinancialHealthBreakdown;
  loanReadiness: LoanReadinessBreakdown;
  lostMoney: LostMoneySummary;
  duplicates: DuplicateCandidate[];
  collections: CollectFirstItem[];
  alerts: Alert[];
  invoices: Invoice[];
  bankTransactions: BankTransaction[];
  inventory: InventoryItem[];
  products: Product[];
  monthlySeries: MonthlyRevenuePoint[];
  onNavigate: (path: string) => void;
}> = ({
  language,
  shop,
  health,
  loanReadiness,
  lostMoney,
  duplicates,
  collections,
  alerts,
  invoices,
  bankTransactions,
  inventory,
  products,
  monthlySeries,
  onNavigate,
}) => {
  const isDemoShop = invoices.some((i) => i.id === 'inv-101');
  const newSalesTotal = invoices
    .filter((i) => i.type === 'sale' && !['inv-101', 'inv-102', 'inv-103', 'inv-104'].includes(i.id))
    .reduce((s, i) => s + i.total, 0);
  const todaySales = isDemoShop ? 18500 + newSalesTotal : newSalesTotal;

  const aprilMonth = monthlySeries[monthlySeries.length - 1] || {
    month: 'Apr',
    revenue: 0,
    collected: 0,
    pending: 0,
    expenses: 0,
  };

  const totalToCollect = collections.reduce((s, c) => s + c.outstandingAmount, 0);
  const topOverdue = collections[0];
  const topDuplicate = duplicates[0];
  const unmatchedCount = bankTransactions.filter(
    (t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  ).length;
  const lowStockItems = inventory.filter((i) => i.quantity <= i.reorderLevel);

  const isCleanShop =
    invoices.length === 0 && bankTransactions.length === 0 && collections.length === 0;

  const munimSummaryText = isCleanShop
    ? `Aapki dukan (${shop.shopName}) ka khata bilkul saaf hai (0 demo data). Voice Bill, Scan Bill, ya Cross-Check Statement & Bill se apna hisab shuru karein.`
    : language === 'en'
      ? `Today’s sales are ${formatINR(todaySales)}. ${
          topOverdue
            ? `${topOverdue.customerName} has ${formatINR(topOverdue.outstandingAmount)} pending (${topOverdue.daysOverdue} days overdue).`
            : 'No overdue customer balances.'
        } ${
          topDuplicate
            ? `1 possible duplicate payment of ${formatINR(topDuplicate.amount)} to ${topDuplicate.counterpartyName} was detected.`
            : ''
        }`
      : language === 'hi'
        ? `आज बिक्री ${formatINR(todaySales)} रही। ${
            topOverdue
              ? `${topOverdue.customerName} का ${formatINR(topOverdue.outstandingAmount)} बाकी है (${topOverdue.daysOverdue} दिन)।`
              : 'कोई पुराना उधार बाकी नहीं है।'
          }`
        : `Aaj sales ${formatINR(todaySales)} rahi (${invoices.length} bills). ${
            topOverdue
              ? `${topOverdue.customerName} ka ${formatINR(topOverdue.outstandingAmount)} pending hai.`
              : 'Koi overdue udhaar nahi hai.'
          } ${
            topDuplicate
              ? `Ek possible duplicate payment ${formatINR(topDuplicate.amount)} ka mila hai.`
              : ''
          }`;

  return (
    <div className="space-y-6">
      {/* 1. Hisab Kitab Brand Tagline & Daily Briefing Card */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <span>HISAB KITAB · {shop.shopName}</span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#082F5E] sm:text-2xl">
              Bill Se Bank Tak, Saara Hisab Ek Jagah
            </h1>
            <p className="mt-1.5 text-sm font-semibold text-slate-800 sm:text-base">
              “{munimSummaryText}”
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/cross-check')}
              className="rounded-xl bg-[#00966B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#007F5A] whitespace-nowrap"
            >
              ✓ Cross-Check Statement &amp; Bill →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/munim')}
              className="rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
            >
              Ask Hisab Kitab AI →
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions Bar (Including Cross-Check Statement & Bill) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => onNavigate('/voice')}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-emerald-600 transition-colors"
        >
          <div>
            <p className="text-xs font-bold text-emerald-700">🎤 Voice Bill</p>
            <p className="mt-0.5 text-xs text-slate-600">Speak in Hinglish</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/scan')}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-emerald-600 transition-colors"
        >
          <div>
            <p className="text-xs font-bold text-emerald-700">📷 Scan Bill</p>
            <p className="mt-0.5 text-xs text-slate-600">JPEG / PNG / Camera</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/cross-check')}
          className="flex items-center justify-between rounded-xl border-2 border-emerald-600 bg-emerald-50/60 px-4 py-3.5 text-left hover:bg-emerald-50 transition-colors"
        >
          <div>
            <p className="text-xs font-extrabold text-emerald-800">✅ Cross-Check</p>
            <p className="mt-0.5 text-xs font-medium text-emerald-700">Statement vs Bill</p>
          </div>
          <ArrowRight className="h-4 w-4 text-emerald-700" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/bank-statements')}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-emerald-600 transition-colors"
        >
          <div>
            <p className="text-xs font-bold text-emerald-700">🏦 Bank Statement</p>
            <p className="mt-0.5 text-xs text-slate-600">Upload CSV / Entry</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/lost-money')}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-emerald-600 transition-colors col-span-2 sm:col-span-1"
        >
          <div>
            <p className="text-xs font-bold text-red-700">🔍 Find Lost Money</p>
            <p className="mt-0.5 text-xs tabular-nums font-semibold text-slate-800">
              {formatINR(lostMoney.heroRecoveryTotal)}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* 3. Three Hero Outcome Tiles */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Tile 1: Potential Money Recovery (SAVE + GET) */}
        <div
          onClick={() => onNavigate('/lost-money')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-6 hover:border-emerald-600 transition-colors flex flex-col justify-between"
        >
          <div>
            <p className="text-xs font-bold text-emerald-700">
              SAVE MONEY · GET MONEY · HIGH-PRIORITY
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              Potential Money Recovery
            </h2>
            <p className="mt-2 tabular-nums text-4xl font-bold tracking-tight text-slate-900">
              {formatINR(lostMoney.heroRecoveryTotal)}
            </p>
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Duplicate payments</span>
                <span className="tabular-nums font-bold text-red-700">
                  {formatINR(lostMoney.duplicatePaymentsTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Overdue customer udhaar</span>
                <span className="tabular-nums font-bold text-amber-700">
                  {formatINR(lostMoney.overdueCollectionsHeroTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Supplier overpayments</span>
                <span className="tabular-nums font-bold text-emerald-700">
                  {formatINR(lostMoney.overpaymentTotal)}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-emerald-700">
            Open Find My Lost Money Breakdown →
          </p>
        </div>

        {/* Tile 2: Financial Health Score Ring */}
        <div
          onClick={() => onNavigate('/health')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-6 hover:border-emerald-600 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">GET READY · HEALTH</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">Financial Health</h2>
              <p className="mt-1 text-xs font-semibold text-emerald-700">{health.status}</p>
              <p className="mt-2 text-xs text-slate-600">
                {formatINR(aprilMonth.revenue)} monthly revenue · {invoices.length} bills recorded
              </p>
            </div>
            <ScoreRing score={health.score} size={104} strokeWidth={9} />
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-emerald-700">
            Explain 7 Health Factors &amp; Cashflow →
          </p>
        </div>

        {/* Tile 3: Loan Readiness Score Ring */}
        <div
          onClick={() => onNavigate('/loan-readiness')}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white p-6 hover:border-emerald-600 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-blue-700">GET READY · LOAN READINESS</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">Loan Readiness</h2>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                {unmatchedCount > 0 || totalToCollect > 0
                  ? `${unmatchedCount} unmatched · ${formatINR(totalToCollect)} pending`
                  : '✓ Clean & reconciled ledger'}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Internal readiness indicator, not a bank credit score.
              </p>
            </div>
            <ScoreRing score={loanReadiness.score} size={104} strokeWidth={9} />
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-emerald-700">
            Why Your Score Is {loanReadiness.score} &amp; Simulator →
          </p>
        </div>
      </div>

      {/* 4. Financial Overview Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Today’s Sales</p>
          <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
            {formatINR(todaySales)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">April Revenue</p>
          <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
            {formatINRCompact(aprilMonth.revenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Collected (Apr)</p>
          <p className="mt-1 tabular-nums text-xl font-bold text-emerald-700">
            {formatINRCompact(aprilMonth.collected)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{UI_DICT[language].receivablesLabel}</p>
          <p className="mt-1 tabular-nums text-xl font-bold text-amber-700">
            {formatINR(totalToCollect)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">April Pending</p>
          <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
            {formatINRCompact(aprilMonth.pending)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">April Expenses</p>
          <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
            {formatINRCompact(aprilMonth.expenses)}
          </p>
        </div>
      </div>

      {/* 5. AI Intelligence & Collect First Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              AI Money Intelligence &amp; Priority Alerts
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/alerts')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              All Alerts ({alerts.length}) →
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold text-slate-800">
                ✓ Koi pending alert ya duplicate payment nahi hai
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Jaise hi aap bills aur bank statements add karenge, Hisab Kitab AI alerts yahan dikhengi.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  onClick={() => onNavigate(a.actionRoute)}
                  className="cursor-pointer py-3 flex items-start justify-between gap-3 hover:bg-slate-50/70 rounded px-2 -mx-2"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{a.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{a.body}</p>
                  </div>
                  {a.amountAtStake && (
                    <span className="tabular-nums text-xs font-bold text-red-700 whitespace-nowrap">
                      {formatINR(a.amountAtStake)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Collect First (Pending Udhaar)</h2>
            <button
              type="button"
              onClick={() => onNavigate('/reminders')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Smart Reminders →
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold text-slate-800">
                ✓ ₹0 Pending Customer Udhaar
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Koi overdue udhaar baaki nahi hai. Naya bill banane ke liye Voice Bill ya Scan Bill use karein.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {collections.map((c) => (
                <div
                  key={c.customerId}
                  onClick={() => onNavigate(`/customers/${c.customerId}`)}
                  className="cursor-pointer py-3 flex items-center justify-between text-xs hover:bg-slate-50 rounded px-2 -mx-2"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      #{c.rank} {c.customerName}
                    </p>
                    <p className="text-slate-500">
                      {c.daysOverdue} days overdue ·{' '}
                      {c.tier === 'critical_recovery' ? 'High-Priority Recovery' : 'Follow up'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-bold text-amber-800">
                      {formatINR(c.outstandingAmount)}
                    </p>
                    <span className="text-[11px] font-semibold text-emerald-700">Send Reminder →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Low-stock products needing reorder: <strong>{lowStockItems.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/inventory')}
              className="font-semibold text-emerald-700 hover:underline"
            >
              Inventory →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OnboardingAndSettingsPage: React.FC<{
  mode: 'onboarding' | 'settings' | 'shop-profile';
  language: Language;
  shop: Shop;
  providerStatus: Record<string, string>;
  onUpdateProfile: (patch: Record<string, unknown>) => Promise<void>;
  onResetDemo: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ mode, language, shop, providerStatus, onUpdateProfile, onResetDemo, onNavigate }) => {
  const [shopName, setShopName] = useState(shop.shopName);
  const [ownerName, setOwnerName] = useState(shop.ownerName);
  const [mobile, setMobile] = useState(shop.mobile);
  const [email, setEmail] = useState(shop.email);
  const [address, setAddress] = useState(shop.address);
  const [businessType, setBusinessType] = useState(shop.businessType);
  const [gstin, setGstin] = useState(shop.gstin || '');
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [demoMode, setDemoMode] = useState(shop.demoMode);
  const [savedBanner, setSavedBanner] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      shopName,
      ownerName,
      mobile,
      email,
      address,
      businessType,
      gstin,
      language: selectedLang,
      demoMode,
    });
    setSavedBanner('✓ Shop profile and language preferences saved.');
    if (mode === 'onboarding') {
      onNavigate('/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'onboarding'
              ? 'Welcome to Hisab Kitab — Shop Setup'
              : mode === 'shop-profile'
                ? 'Shop Profile & GST Details'
                : 'Settings, Language & Provider Status'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Configure your language (Hinglish, Hindi, English), shop identity, and Demo vs Live AI providers.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            await onResetDemo();
            setSavedBanner('✓ Demo dataset reset to initial Agarwal Kirana & Hardware state.');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Load / Reset Demo Data</span>
        </button>
      </div>

      {savedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {savedBanner}
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
          {!avatarError ? (
            <img
              src={ownerAvatarImg}
              alt="Shop Owner Profile"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="h-14 w-14 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              RA
            </div>
          )}
          <div>
            <h2 className="text-base font-bold text-slate-900">{shopName}</h2>
            <p className="text-xs text-slate-500">
              Owner: {ownerName} · Plan: <strong className="uppercase">{shop.plan}</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Preferred Language (UI, Chat &amp; Reminders)
            </label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as Language)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
            >
              <option value="hinglish">Hinglish (Default for Indian MSMEs)</option>
              <option value="hi">Hindi (हिंदी देवनागरी)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Owner Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Business Category</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as Shop['businessType'])}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="kirana">Kirana &amp; Grocery</option>
              <option value="hardware">Hardware &amp; Construction</option>
              <option value="medical">Medical &amp; Pharmacy</option>
              <option value="clothing">Clothing &amp; Textiles</option>
              <option value="mobile">Mobile &amp; Electronics</option>
              <option value="trader">Wholesale Trader</option>
              <option value="restaurant">Restaurant &amp; Food</option>
              <option value="service">Service Business</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Mobile Number</label>
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">GSTIN (Optional)</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">Shop Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span>
              Enable Deterministic Demo Mode (Zero external API keys needed; uncheck to use live Gemini API when configured)
            </span>
          </label>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            {mode === 'onboarding' ? 'Save & Open Dashboard →' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Provider Status Panel (§9) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Service Providers Status (Demo vs Production Architecture)
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          All AI, OCR, Speech, Storage, and Messaging providers run behind replaceable interfaces with automatic fallback.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(providerStatus || {}).map(([service, status]) => (
            <div key={service} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <p className="font-bold uppercase text-slate-700">{service} Provider</p>
              <p className="mt-1 font-mono font-semibold text-emerald-700">{status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Architecture Matrix (Free / Pro / Business) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Plan Architecture &amp; Feature Entitlements (UI Reference Only)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-bold text-slate-900">Free Plan — For Small Retail Counters</p>
            <p className="mt-1 text-slate-600">
              Voice Billing, Khata Ledger, Basic Invoices, 20 Bill Scans/month
            </p>
          </div>
          <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50/30 p-4">
            <p className="font-bold text-emerald-900">Pro Plan (Active Demo) — For Growing MSMEs</p>
            <p className="mt-1 text-slate-700">
              Unlimited Multimodal Scan, 8-Signal Bank Reconciliation, Lost Money Detector, Credit Pack PDF
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-bold text-slate-900">Business Plan — For Multi-Branch Traders</p>
            <p className="mt-1 text-slate-600">
              Multi-User Access, Supplier Price Intelligence, Priority CA Export
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
