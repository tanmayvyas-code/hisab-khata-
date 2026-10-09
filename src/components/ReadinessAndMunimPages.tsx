import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  Mic,
  MicOff,
  Send,
  Sliders,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  AiMessage,
  CashflowForecast,
  CollectFirstItem,
  FinancialHealthBreakdown,
  Language,
  LoanReadinessBreakdown,
  LostMoneySummary,
  MonthlyRevenuePoint,
  ProfitLeakageInsight,
  ScoreSnapshot,
  Shop,
} from '../types/domain';
import {
  formatINR,
  formatINRCompact,
  LOADING_MESSAGES,
  LOAN_READINESS_DISCLAIMER,
} from '../i18n/translations';
import { computeLoanReadiness, ScoringInputData, WhatIfOptions } from '../engines/scoringEngine';
import { generateCreditPackPdfBytes } from '../engines/pdfGenerator';
import { HinglishLoader, LoanDisclaimerBanner, ScoreRing } from './ui';

export const FinancialHealthPage: React.FC<{
  health: FinancialHealthBreakdown;
  cashflow: CashflowForecast;
  profitLeakage: ProfitLeakageInsight[];
  snapshots: ScoreSnapshot[];
  onNavigate: (path: string) => void;
}> = ({ health, cashflow, profitLeakage, snapshots, onNavigate }) => {
  const [forecastHorizon, setForecastHorizon] = useState<'15d' | '30d'>('15d');
  const points = forecastHorizon === '15d' ? cashflow.points15d : cashflow.points30d;
  const maxBal = Math.max(...points.map((p) => p.projectedBalance), 160000);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-emerald-700">GET READY · FINANCIAL HEALTH</p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
            Financial Health &amp; Cash-Flow Forecast
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">{health.summaryText}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/loan-readiness')}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
        >
          View Loan Readiness (72/100) →
        </button>
      </div>

      {/* Score & Weighted Factors */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center">
          <ScoreRing
            score={health.score}
            size={140}
            strokeWidth={11}
            label={`Status: ${health.status}`}
            sublabel="Deterministic 7-Factor Score"
          />
          <div className="mt-5 w-full border-t border-slate-100 pt-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Recent Monthly Snapshots</p>
            <div className="mt-2 flex justify-around tabular-nums">
              {snapshots
                .filter((s) => s.kind === 'financial_health')
                .map((s) => (
                  <div key={s.id}>
                    <p className="text-slate-500">{s.periodLabel}</p>
                    <p className="font-bold text-slate-900">{s.score}/100</p>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">
            Explainable Factor Breakdown (Weights Sum to 100%)
          </h2>
          <div className="mt-4 space-y-3">
            {health.factors.map((f) => (
              <div key={f.key} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    {f.label} <span className="font-normal text-slate-500">(Weight {f.weight}%)</span>
                  </span>
                  <span className="tabular-nums font-bold text-slate-900">
                    {f.score}/100 → +{f.weightedPoints} pts
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{f.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cashflow Forecast (15/30-day Estimate) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-700">
              CASHFLOW FORECAST · ESTIMATE, NOT A GUARANTEE
            </p>
            <h2 className="text-base font-bold text-slate-900">{cashflow.advisoryMessage}</h2>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setForecastHorizon('15d')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                forecastHorizon === '15d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              15-Day Forecast
            </button>
            <button
              type="button"
              onClick={() => setForecastHorizon('30d')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                forecastHorizon === '30d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              30-Day Forecast
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Current Bank Balance</p>
            <p className="mt-1 tabular-nums text-lg font-bold text-slate-900">
              {formatINR(cashflow.currentBalance)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Expected Collections (15d Est)</p>
            <p className="mt-1 tabular-nums text-lg font-bold text-emerald-700">
              +{formatINR(cashflow.expectedCollections15d)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Expected Outflows (15d Est)</p>
            <p className="mt-1 tabular-nums text-lg font-bold text-red-700">
              -{formatINR(cashflow.expectedExpenses15d)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Projected 15d Balance</p>
            <p className="mt-1 tabular-nums text-lg font-bold text-slate-900">
              {formatINR(cashflow.projectedBalance15d)}
            </p>
          </div>
        </div>

        {/* Visual Forecast Bars */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 pt-2">
          {points.slice(0, 6).map((pt) => {
            const heightPct = Math.max(20, Math.round((pt.projectedBalance / maxBal) * 100));
            return (
              <div key={pt.dayLabel} className="flex flex-col items-center rounded-lg border border-slate-100 p-3">
                <div className="flex h-24 w-full items-end justify-center">
                  <div
                    className="w-8 rounded-t bg-emerald-600 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <p className="mt-2 tabular-nums text-xs font-bold text-slate-900">
                  {formatINRCompact(pt.projectedBalance)}
                </p>
                <p className="text-[11px] text-slate-500">{pt.dayLabel}</p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500">{cashflow.disclaimer}</p>
      </div>

      {/* Profit Leakage Causal Analysis */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Causal Profit Leakage Analysis
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profitLeakage.map((pl) => (
            <div key={pl.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-amber-800 uppercase">{pl.type.replace('_', ' ')}</span>
                <span className="tabular-nums font-bold text-slate-900">
                  Impact: {formatINR(pl.monthlyImpact)}
                </span>
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{pl.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{pl.causalExplanation}</p>
              <button
                type="button"
                onClick={() => onNavigate(pl.actionRoute)}
                className="mt-2 text-xs font-semibold text-emerald-700 hover:underline"
              >
                {pl.recommendation} →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const LoanReadinessPage: React.FC<{
  loanReadiness: LoanReadinessBreakdown;
  scoringInput: ScoringInputData;
  snapshots: ScoreSnapshot[];
  onNavigate: (path: string) => void;
}> = ({ loanReadiness, scoringInput, snapshots, onNavigate }) => {
  const [whatIf, setWhatIf] = useState<WhatIfOptions>({
    resolveUnmatched: false,
    collectSeriousOverdue: false,
    recoverDuplicate: false,
    adjustOverpayment: false,
  });

  const simulated = computeLoanReadiness(scoringInput, whatIf);
  const delta = simulated.score - loanReadiness.score;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-blue-700">GET READY · LOAN READINESS &amp; SIMULATOR</p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
            Loan Readiness Score &amp; What-If Simulator
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Understand why your score is {loanReadiness.score}/100 and simulate how fixing issues boosts your readiness.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/credit-pack')}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
        >
          Generate Credit Pack PDF →
        </button>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <LoanDisclaimerBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center">
          <ScoreRing
            score={simulated.score}
            size={148}
            strokeWidth={11}
            label={
              delta > 0
                ? `Projected Score: ${simulated.score}/100 (+${delta} pts)`
                : `Current Score: ${loanReadiness.score}/100`
            }
            sublabel={simulated.status}
          />
          <div className="mt-5 w-full border-t border-slate-100 pt-4 text-xs">
            <p className="font-semibold text-amber-800">
              ⚠️ Score dropped 10 pts (Mar: 82 → Apr: 72) due to 3 unmatched bank payments &amp; 45d overdue
            </p>
            <div className="mt-2 flex justify-around tabular-nums text-slate-600">
              {snapshots
                .filter((s) => s.kind === 'loan_readiness')
                .map((s) => (
                  <div key={s.id}>
                    <p>{s.periodLabel}</p>
                    <p className="font-bold text-slate-900">{s.score}/100</p>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Why Your Score is 72 + What-If Simulator */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Why Your Score Is {simulated.score}/100
            </h2>
            <div className="mt-2.5 space-y-1.5 text-xs font-medium text-slate-800">
              {simulated.whyBullets.map((b, i) => (
                <p key={i}>{b.text}</p>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Interactive What-If Simulator (Toggle Fixes to Preview Projected Score)
              </h3>
              <span className="text-xs font-semibold text-emerald-700">
                Base: {loanReadiness.score} → Simulated: {simulated.score}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {loanReadiness.recommendations.map((rec) => {
                const key = rec.id as keyof WhatIfOptions;
                const checked = Boolean(whatIf[key]);
                return (
                  <div
                    key={rec.id}
                    className={`flex flex-col justify-between gap-3 rounded-lg border p-3.5 sm:flex-row sm:items-center ${
                      checked ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200'
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setWhatIf({ ...whatIf, [key]: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {rec.title}{' '}
                          <span className="text-emerald-700 tabular-nums">(+{rec.impactPoints} pts)</span>
                        </p>
                        <p className="text-xs text-slate-600">{rec.description}</p>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => onNavigate(rec.actionRoute)}
                      className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                    >
                      Go to Fix →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Deterministic Factor Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Loan Readiness Factor Breakdown (Deterministic Weights)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {simulated.factors.map((f) => (
            <div key={f.key} className="rounded-lg border border-slate-200 p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <span>
                  {f.label} ({f.weight}%)
                </span>
                <span className="tabular-nums">
                  {f.score}/100 (+{f.weightedPoints} pts)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{f.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CreditPackAndReportsPage: React.FC<{
  mode: 'credit-pack' | 'reports';
  language: Language;
  shop: Shop;
  health: FinancialHealthBreakdown;
  loanReadiness: LoanReadinessBreakdown;
  lostMoney: LostMoneySummary;
  cashflow: CashflowForecast;
  collections: CollectFirstItem[];
  monthlySeries: MonthlyRevenuePoint[];
  lowStockCount: number;
  onNavigate: (path: string) => void;
}> = ({
  mode,
  language,
  shop,
  health,
  loanReadiness,
  lostMoney,
  cashflow,
  collections,
  monthlySeries,
  lowStockCount,
  onNavigate,
}) => {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadedBanner, setDownloadedBanner] = useState('');

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    setDownloadedBanner('');
    await new Promise((r) => setTimeout(r, 450));
    try {
      const pdfBytes = generateCreditPackPdfBytes({
        shop,
        generatedAt: new Date().toISOString(),
        financialHealth: health,
        loanReadiness,
        lostMoney,
        cashflow,
        collections,
        monthlySeries,
      });

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hisab_Kitab_Credit_Pack_${shop.shopName.replace(/[^A-Za-z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadedBanner(
        `✓ Lender-Ready Credit Pack PDF (${Math.round(pdfBytes.byteLength / 1024)} KB, 2 pages) generated and downloaded!`
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  const aprilMonth = monthlySeries[monthlySeries.length - 1] || {
    month: 'Apr',
    revenue: 420000,
    collected: 370000,
    pending: 50000,
    expenses: 295000,
  };

  if (mode === 'reports') {
    const maxRev = Math.max(...monthlySeries.map((m) => m.revenue), 450000);
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Reports &amp; Monthly Munim Report (April Business Summary)
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              All figures computed directly from your shop’s invoices, collections, and inventory records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/credit-pack')}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            Open Lender Credit Pack PDF →
          </button>
        </div>

        {/* April Monthly Munim Report Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">MONTHLY MUNIM REPORT · APRIL 2026</p>
              <h2 className="text-lg font-bold text-slate-900">{shop.shopName} — April Business Summary</h2>
            </div>
            <span className="text-xs text-slate-500">Generated from live ledger records</span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">April Revenue</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-slate-900">
                {formatINRCompact(aprilMonth.revenue)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Collected</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-emerald-700">
                {formatINRCompact(aprilMonth.collected)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">April Pending</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-amber-700">
                {formatINRCompact(aprilMonth.pending)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Duplicate Payout</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-red-700">
                {formatINR(lostMoney.duplicatePaymentsTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Low-Stock Items</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-slate-900">{lowStockCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Financial Health</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-emerald-700">{health.score}/100</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Loan Readiness</p>
              <p className="mt-1 tabular-nums text-lg font-bold text-blue-700">
                {loanReadiness.score}/100
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-slate-800 space-y-1.5">
            <p className="font-bold text-emerald-900">Munim’s Advice for May:</p>
            <p>
              1. <strong>Recover ₹18,500 Duplicate Payment:</strong> Gupta Traders ko Bill GT-INV-2026-402 ke liye 2 baar payment gaya hai — credit note ya refund lein.
            </p>
            <p>
              2. <strong>Clear 45-Day Overdue Udhaar:</strong> Rahul Sharma (₹42,000) aur Amit Traders (₹18,500) ko WhatsApp reminder bhejkar working capital free karein.
            </p>
            <p>
              3. <strong>Switch Rice Supplier Rate:</strong> Sona Masoori Rice par Supplier B (₹48/kg) se kharidari karke ₹3,400/mahina bachayein.
            </p>
          </div>
        </div>

        {/* 6-Month Revenue & Collection Visual Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">
            6-Month Revenue, Collection &amp; Expense Trend
          </h2>
          <div className="mt-6 grid grid-cols-6 gap-4">
            {monthlySeries.map((m) => {
              const revH = Math.round((m.revenue / maxRev) * 100);
              const colH = Math.round((m.collected / maxRev) * 100);
              return (
                <div key={m.month} className="flex flex-col items-center">
                  <div className="flex h-36 w-full items-end justify-center gap-1.5">
                    <div
                      title={`Revenue: ${formatINR(m.revenue)}`}
                      className="w-5 rounded-t bg-slate-900"
                      style={{ height: `${revH}%` }}
                    />
                    <div
                      title={`Collected: ${formatINR(m.collected)}`}
                      className="w-5 rounded-t bg-emerald-600"
                      style={{ height: `${colH}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-900">{m.month}</p>
                  <p className="tabular-nums text-[11px] text-slate-600">
                    {formatINRCompact(m.revenue)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Credit Pack PDF Page
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-emerald-700">GET READY · LENDER DOSSIER</p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
            Lender-Ready Credit Pack PDF
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            2-page structured financial dossier with revenue trend, collections, scores, and mandatory disclaimer.
          </p>
        </div>
        <button
          type="button"
          disabled={generatingPdf}
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>{generatingPdf ? 'Preparing PDF...' : 'Download Credit Pack PDF (.pdf)'}</span>
        </button>
      </div>

      {generatingPdf && <HinglishLoader message={LOADING_MESSAGES[language].pdf} />}

      {downloadedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {downloadedBanner}
        </div>
      )}

      <LoanDisclaimerBanner />

      {/* Live Preview of the Credit Pack Dossier */}
      <div className="rounded-xl border border-slate-300 bg-white p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold text-emerald-700">
              HISAB KITAB · MSME LENDER CREDIT PACK DOSSIER
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{shop.shopName}</h2>
            <p className="text-xs text-slate-600">
              Proprietor: {shop.ownerName} · GSTIN: {shop.gstin} · Vintage: {shop.vintageMonths} Months
            </p>
            <p className="text-xs text-slate-500">{shop.address}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-mono font-semibold text-slate-800">REF: CP-{shop.id.toUpperCase()}</p>
            <p>Date: 2026-04-28</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Financial Health Score</p>
            <p className="mt-1 tabular-nums text-2xl font-bold text-emerald-700">
              {health.score} / 100
            </p>
            <p className="text-xs text-slate-600">{health.status}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Loan Readiness Indicator</p>
            <p className="mt-1 tabular-nums text-2xl font-bold text-blue-700">
              {loanReadiness.score} / 100
            </p>
            <p className="text-xs text-slate-600">{loanReadiness.status}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">April Realized / Billed Turnover</p>
            <p className="mt-1 tabular-nums text-2xl font-bold text-slate-900">
              {formatINRCompact(aprilMonth.collected)} / {formatINRCompact(aprilMonth.revenue)}
            </p>
            <p className="text-xs text-slate-600">88% Collection Efficiency</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Month</th>
                <th className="px-4 py-2.5 text-right">Billed Revenue</th>
                <th className="px-4 py-2.5 text-right">Collected</th>
                <th className="px-4 py-2.5 text-right">Pending</th>
                <th className="px-4 py-2.5 text-right">Expenses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {monthlySeries.map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-2 font-semibold">{m.month}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.revenue)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                    {formatINR(m.collected)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-700">
                    {formatINR(m.pending)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatINR(m.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <strong className="text-slate-900">Mandatory Disclaimer in PDF: </strong>
          {LOAN_READINESS_DISCLAIMER}
        </div>
      </div>
    </div>
  );
};

export const AiMunimChatPage: React.FC<{
  language: Language;
  messages: AiMessage[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ messages, onRefreshState, onNavigate }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastCustomerId, setLastCustomerId] = useState<string | undefined>('cust-rahul');

  const suggestionChips = [
    'Munim ji, mera sabse bada financial problem kya hai?',
    'Aaj kitni sale hui?',
    'Sabse zyada paisa kis customer se lena hai?',
    'Meri loan readiness kam kyu hai?',
    'Pichle mahine ke comparison mein sales kaisi hain?',
    'Kaunse supplier se mehenga maal aa raha hai?',
    'Rahul ka khata dikhao',
    'Usko reminder bana do',
    'Rahul ko ₹2,000 payment add karo',
    '30 din se pending customers ki list banao',
    'Gupta Traders ka latest invoice dikhao',
  ];

  const sendMessage = async (textToSend = input) => {
    const clean = textToSend.trim();
    if (!clean) return;
    setSending(true);
    setInput('');
    try {
      const res = await fetch('/api/munim/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          lastMentionedCustomerId: lastCustomerId,
        }),
      });
      const data = await res.json();
      if (data.mentionedCustomerId) {
        setLastCustomerId(data.mentionedCustomerId);
      }
      await onRefreshState();
    } finally {
      setSending(false);
    }
  };

  const handleActionDecision = async (messageId: string, decision: 'confirm' | 'cancel') => {
    setSending(true);
    try {
      await fetch('/api/munim/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, decision }),
      });
      await onRefreshState();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hisab Kitab AI Copilot (Tool-Grounded Business Chat)
          </h1>
          <p className="text-xs text-slate-600">
            Answers strictly from verified shop tools — never invents numbers, and always asks confirmation before saving.
          </p>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-1.5">
        {suggestionChips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => sendMessage(chip)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-800 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 max-h-[540px] overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-xl px-4 py-3 text-sm whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              {m.content}

              {/* Tool Grounding Audit Trail */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mt-2.5 border-t border-slate-200/80 pt-2 text-[11px] text-slate-500">
                  {m.toolCalls.map((tc, i) => (
                    <p key={i} className="font-mono">
                      ✓ Grounded Tool: <strong>{tc.toolName}</strong> → {tc.resultSummary}
                    </p>
                  ))}
                </div>
              )}

              {/* Structured Cards (Customer Khata / Reminder Draft / Ranked Problems / Invoice) */}
              {m.structuredCard && m.structuredCard.type === 'ranked_problems' && (
                <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  {((m.structuredCard.data.problems as any[]) || []).map((prob) => (
                    <div key={prob.rank} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-900">
                          #{prob.rank} {prob.title}
                        </p>
                        <p className="tabular-nums font-semibold text-red-700">
                          {formatINR(prob.amount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate(prob.route)}
                        className="rounded bg-slate-900 px-2.5 py-1 text-white font-semibold"
                      >
                        {prob.actionLabel} →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {m.structuredCard && m.structuredCard.type === 'customer_khata' && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {String(m.structuredCard.data.customerName)}
                    </p>
                    <p className="tabular-nums text-amber-800 font-semibold">
                      Pending: {formatINR(Number(m.structuredCard.data.outstandingAmount))} (
                      {String(m.structuredCard.data.daysOverdue)}d overdue)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(`/customers/${String(m.structuredCard?.data.customerId)}`)
                    }
                    className="rounded bg-emerald-600 px-3 py-1.5 text-white font-semibold"
                  >
                    Open Full Khata →
                  </button>
                </div>
              )}

              {m.structuredCard && m.structuredCard.type === 'reminder_draft' && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-2">
                  <p className="italic text-slate-800">
                    “{String(m.structuredCard.data.draftText)}”
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500">Draft only</span>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard?.writeText(String(m.structuredCard?.data.draftText))
                      }
                      className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700"
                    >
                      Copy Reminder Draft
                    </button>
                  </div>
                </div>
              )}

              {/* Write Action Confirmation Card */}
              {m.actionProposal && (
                <div className="mt-3 rounded-lg border-2 border-emerald-600 bg-white p-3.5 text-xs">
                  <p className="font-bold text-emerald-800">
                    CONFIRMATION REQUIRED: {m.actionProposal.title}
                  </p>
                  <p className="mt-0.5 text-slate-700">{m.actionProposal.summary}</p>
                  {m.actionProposal.status === 'pending' ? (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleActionDecision(m.id, 'confirm')}
                        className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                      >
                        Confirm &amp; Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleActionDecision(m.id, 'cancel')}
                        className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 font-bold text-emerald-700 capitalize">
                      ✓ Action {m.actionProposal.status}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask Hisab Kitab anything — e.g. "Mera sabse bada financial problem kya hai?"'
          className="flex-1 px-3 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Send className="h-4 w-4" />
          <span>{sending ? 'Thinking...' : 'Ask Hisab AI'}</span>
        </button>
      </form>
    </div>
  );
};
