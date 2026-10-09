import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  HelpCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import {
  BankStatement,
  BankTransaction,
  DuplicateCandidate,
  Invoice,
  Language,
  LostMoneySummary,
  Payment,
  ReconciliationMatch,
} from '../types/domain';
import {
  EMPTY_MESSAGES,
  ERROR_MESSAGES,
  formatINR,
  LOADING_MESSAGES,
} from '../i18n/translations';
import { ConfidenceBar, EmptyStateCard, HinglishLoader, StatusLabel } from './ui';

export const FindLostMoneyPage: React.FC<{
  language: Language;
  lostMoney: LostMoneySummary;
  duplicates: DuplicateCandidate[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ language, lostMoney, duplicates, onRefreshState, onNavigate }) => {
  const [scanning, setScanning] = useState(false);
  const [showBucketTooltip, setShowBucketTooltip] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleScanAgain = async () => {
    setScanning(true);
    await onRefreshState();
    setScanning(false);
  };

  const handleConfirmDuplicate = async (dupId: string) => {
    await fetch('/api/duplicates/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicateId: dupId, status: 'confirmed' }),
    });
    await onRefreshState();
  };

  const heroItems = lostMoney.items.filter((i) => i.bucket === 'hero_high_priority');
  const followUpItems = lostMoney.items.filter((i) => i.bucket === 'follow_up');

  return (
    <div className="space-y-6">
      {/* Header & Three Outcomes Framing */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-emerald-700">
            SAVE MONEY · GET MONEY · GET READY
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
            Find My Lost Money (Potential Recovery Center)
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Evidence-backed duplicate payouts, seriously overdue collections, and supplier overpayments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleScanAgain}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          <span>Scan Again</span>
        </button>
      </div>

      {scanning && <HinglishLoader message={LOADING_MESSAGES[language].duplicates} />}

      {/* Hero Recovery Total Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                HIGH-PRIORITY EVIDENCE-BACKED RECOVERY
              </span>
              <button
                type="button"
                onClick={() => setShowBucketTooltip(!showBucketTooltip)}
                aria-label="Explain recovery calculation bucket"
                className="text-slate-400 hover:text-slate-700"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 tabular-nums text-4xl font-bold tracking-tight text-emerald-700 sm:text-5xl">
              {formatINR(lostMoney.heroRecoveryTotal)}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              Exact composition: Duplicate payments ({formatINR(lostMoney.duplicatePaymentsTotal)}) +
              Seriously overdue &ge;40d ({formatINR(lostMoney.overdueCollectionsHeroTotal)}) + Supplier
              overpayment ({formatINR(lostMoney.overpaymentTotal)})
            </p>

            {showBucketTooltip && (
              <div className="mt-3 max-w-xl rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <strong>How this ₹67,500 figure is defined:</strong> The Hero Recovery bucket counts only
                high-priority, evidence-backed items: (1) Possible duplicate payment to Gupta Traders (
                {formatINR(lostMoney.duplicatePaymentsTotal)}), (2) Seriously overdue receivables &ge;40 days
                from Rahul Sharma ({formatINR(lostMoney.overdueCollectionsHeroTotal)}), and (3) Verified
                supplier overpayment to Shree Balaji Hardware ({formatINR(lostMoney.overpaymentTotal)}).
                Moderate follow-up receivables ({formatINR(lostMoney.followUpReceivablesTotal)}) are listed
                separately below so numbers never conflict.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[540px]">
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5">
              <p className="text-[11px] font-bold text-red-800">SAVE · DUPLICATE PAYOUT</p>
              <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
                {formatINR(lostMoney.duplicatePaymentsTotal)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">Gupta Traders (Paid 2x)</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5">
              <p className="text-[11px] font-bold text-amber-800">GET · SERIOUS OVERDUE</p>
              <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
                {formatINR(lostMoney.overdueCollectionsHeroTotal)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">Rahul Sharma (45d overdue)</p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
              <p className="text-[11px] font-bold text-emerald-800">SAVE · OVERPAYMENT</p>
              <p className="mt-1 tabular-nums text-xl font-bold text-slate-900">
                {formatINR(lostMoney.overpaymentTotal)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">Shree Balaji Hardware</p>
            </div>
          </div>
        </div>
      </div>

      {/* High-Priority Evidence Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          1. High-Priority Recovery Items ({formatINR(lostMoney.heroRecoveryTotal)})
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {heroItems.map((item) => {
            const linkedDup = duplicates.find((d) => `lm-dup-${d.id}` === item.id);
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-emerald-700">{item.outcomePillar} MONEY</span>
                      <span>·</span>
                      <span>{item.isConfirmed ? 'Confirmed Record' : 'Possible — Needs Confirmation'}</span>
                      <span>·</span>
                      <span className="tabular-nums">Confidence {item.confidence}%</span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-slate-900">
                      {item.title} — <span className="tabular-nums">{formatINR(item.amount)}</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600">Party: {item.partyName}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {linkedDup && linkedDup.status !== 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleConfirmDuplicate(linkedDup.id)}
                        className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirm Duplicate
                      </button>
                    )}
                    {linkedDup && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(linkedDup.vendorDraftMessage);
                          setCopiedId(item.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copiedId === item.id ? 'Vendor Draft Copied!' : 'Copy Vendor Refund Msg'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate(item.actionRoute)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <span>{item.recommendedAction}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  {item.evidence.map((ev, i) => (
                    <li key={i}>• {ev}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary Follow-Up & Readiness Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            2. Additional Follow-Up Receivables, Unmatched Payments & Rate Gaps
          </h2>
          <span className="text-xs text-slate-500">
            Follow-up receivables: <strong className="tabular-nums">{formatINR(lostMoney.followUpReceivablesTotal)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {followUpItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{item.outcomePillar}</span>
                  <span className="tabular-nums font-bold text-slate-900">{formatINR(item.amount)}</span>
                </div>
                <h3 className="mt-1 text-sm font-bold text-slate-900">
                  {item.partyName} — {item.title}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{item.evidence[0]}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => onNavigate(item.actionRoute)}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  {item.recommendedAction} →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BankStatementsPage: React.FC<{
  language: Language;
  statements: BankStatement[];
  transactions: BankTransaction[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ language, statements, transactions, onRefreshState, onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusBanner, setStatusBanner] = useState('');

  const handleUploadDemoStatement = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/statements/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useDemoStatement: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || ERROR_MESSAGES[language].unsupportedStatement);
        return;
      }
      setStatusBanner(
        `✓ Parsed ${data.parsedCount} bank transactions (${data.dedupedCount} duplicate rows automatically skipped via normalizedHash). Reconciliation complete!`
      );
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const text = await file.text();
      const res = await fetch('/api/statements/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || ERROR_MESSAGES[language].unsupportedStatement);
        return;
      }
      setStatusBanner(`✓ Uploaded ${file.name}: ${data.parsedCount} transactions parsed.`);
      await onRefreshState();
    } catch {
      setErrorMsg(ERROR_MESSAGES[language].unsupportedStatement);
    } finally {
      setLoading(false);
    }
  };

  const triggerUnsupportedFormatDemo = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/statements/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'scanned_unstructured.pdf', content: '%PDF-1.4 binary scan' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bank Statements & Normalization</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Upload CSV, Excel, or text-based PDF statements. Automatically extracts UTRs &amp; counterparties.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleUploadDemoStatement}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            Use Demo Statement (SBI April 2026)
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/reconciliation')}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Run / View Reconciliation →
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {statusBanner}
        </div>
      )}

      {errorMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={handleUploadDemoStatement}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
          >
            Load Supported Demo Statement Instead
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Upload Bank Statement (CSV · XLSX · PDF)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Supports flexible headers (Date, Narration/Description, Debit/Withdrawal, Credit/Deposit, Balance, UTR).
              Re-uploading the same statement automatically deduplicates rows via <code className="font-mono">normalizedHash</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4 text-emerald-600" />
              <span>Choose File (.csv / .xlsx / .pdf)</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.pdf"
                onChange={handleCustomFileUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={triggerUnsupportedFormatDemo}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Test Unsupported PDF Error
            </button>
          </div>
        </div>
      </div>

      {loading && <HinglishLoader message={LOADING_MESSAGES[language].statement} />}

      {/* Normalized Bank Transactions Table */}
      {transactions.length === 0 ? (
        <EmptyStateCard
          title={EMPTY_MESSAGES[language].statements}
          actionLabel="Use Demo Statement"
          onAction={handleUploadDemoStatement}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Normalized Bank Transactions ({transactions.length})
              </h2>
              <p className="text-xs text-slate-500">
                Statement: {statements[0]?.fileName || 'SBI_CurrentAccount_Apr2026.csv'} · Period:{' '}
                {statements[0]?.periodStart} to {statements[0]?.periodEnd}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Bank Narration &amp; Extracted Party</th>
                  <th className="px-4 py-3">UTR / Ref</th>
                  <th className="px-4 py-3 text-right">Debit (Out)</th>
                  <th className="px-4 py-3 text-right">Credit (In)</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Reconciliation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap font-medium text-slate-800">
                      {t.date}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {t.counterpartyName || 'Unidentified Counterparty'}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">{t.description}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{t.reference || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-700">
                      {t.debit > 0 ? formatINR(t.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                      {t.credit > 0 ? formatINR(t.credit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatINR(t.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel status={t.matchStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const ReconciliationPage: React.FC<{
  language: Language;
  transactions: BankTransaction[];
  invoices: Invoice[];
  matches: ReconciliationMatch[];
  duplicates: DuplicateCandidate[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ language, transactions, invoices, matches, duplicates, onRefreshState, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'possible' | 'unmatched' | 'duplicates'>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(matches[0]?.id || null);
  const [loading, setLoading] = useState(false);
  const [copiedDupId, setCopiedDupId] = useState<string | null>(null);

  const handleDecision = async (
    bankTransactionId: string,
    decision: 'confirm' | 'reject',
    invoiceId?: string
  ) => {
    setLoading(true);
    try {
      await fetch('/api/reconciliation/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId, decision, invoiceId }),
      });
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateDecision = async (
    duplicateId: string,
    status: 'confirmed' | 'dismissed' | 'reminded_later'
  ) => {
    setLoading(true);
    try {
      await fetch('/api/duplicates/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicateId, status }),
      });
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter((m) => {
    const txn = transactions.find((t) => t.id === m.bankTransactionId);
    if (activeTab === 'all') return true;
    if (activeTab === 'matched')
      return m.status === 'auto_confirmed' || m.status === 'user_confirmed';
    if (activeTab === 'possible') return m.status === 'suggested' || txn?.matchStatus === 'possible';
    if (activeTab === 'unmatched') return m.status === 'unmatched' || txn?.matchStatus === 'unmatched';
    if (activeTab === 'duplicates')
      return m.derivedStatus === 'duplicate' || txn?.matchStatus === 'duplicate';
    return true;
  });

  // Compute summary strip counts & ₹
  const statusBuckets = [
    { key: 'paid', label: 'Paid' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'partial', label: 'Partial' },
    { key: 'overpaid', label: 'Overpaid' },
    { key: 'duplicate', label: 'Duplicate' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            8-Signal Reconciliation &amp; Duplicate Detection
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Weighted matching across amount (30), bill # (20), party similarity (15), UTR (10), date (10), keywords (5), history (5) &amp; balance fit (5).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/payments/inbox')}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
        >
          Open Payment Inbox (Needs Confirm) →
        </button>
      </div>

      {/* Invoice Status Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statusBuckets.map((b) => {
          const matchingInvs = invoices.filter((i) => i.status === b.key);
          const sum = matchingInvs.reduce((s, i) => s + i.total, 0);
          return (
            <div key={b.key} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-medium text-slate-500">
                {b.label} ({matchingInvs.length})
              </p>
              <p className="mt-1 tabular-nums text-lg font-bold text-slate-900">{formatINR(sum)}</p>
            </div>
          );
        })}
      </div>

      {/* 🚨 Possible Duplicate Payment Hero Alert Card */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border-2 border-red-600 bg-white p-6 space-y-4">
          {duplicates.map((dup) => {
            const t1 = transactions.find((t) => t.id === dup.primaryTxnId);
            const t2 = transactions.find((t) => t.id === dup.duplicateTxnId);
            return (
              <div key={dup.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-red-700">
                      🚨 POSSIBLE DUPLICATE PAYMENT DETECTED · CONFIDENCE {dup.confidence}%
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {dup.counterpartyName} paid {formatINR(dup.amount)} twice within {dup.daysApart}{' '}
                      days (Potential Recovery: {formatINR(dup.recoverableAmount)})
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Linked Purchase Bill: <span className="font-mono font-semibold">{dup.invoiceNumber}</span> · Status:{' '}
                      <strong className="uppercase">{dup.status}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicateDecision(dup.id, 'confirmed')}
                      className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      {dup.status === 'confirmed' ? '✓ Confirmed Duplicate' : 'Confirm Duplicate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(dup.vendorDraftMessage);
                        setCopiedDupId(dup.id);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {copiedDupId === dup.id ? 'Copied Vendor Message!' : 'Copy Vendor Refund Message'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateDecision(dup.id, 'reminded_later')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Remind Me Later
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateDecision(dup.id, 'dismissed')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                    >
                      Not a Duplicate
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Transaction Comparison */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                    <p className="font-bold text-slate-800">Payment #1 (Original Settlement)</p>
                    <p className="mt-1 tabular-nums">
                      Date: <strong>{t1?.date}</strong> · Amount: <strong>{formatINR(dup.amount)}</strong>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-600">
                      {t1?.description} (Ref: {t1?.reference})
                    </p>
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50/40 p-3.5 text-xs">
                    <p className="font-bold text-red-900">Payment #2 (Possible Duplicate Outflow)</p>
                    <p className="mt-1 tabular-nums">
                      Date: <strong>{t2?.date}</strong> · Amount: <strong>{formatINR(dup.amount)}</strong>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-700">
                      {t2?.description} (Ref: {t2?.reference})
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Draft Message to Vendor (Draft Only):</p>
                  <p className="mt-1 italic">“{dup.vendorDraftMessage}”</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Segmented Filter Control */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(
          [
            { id: 'all', label: `All (${matches.length})` },
            {
              id: 'matched',
              label: `Matched (${matches.filter((m) => m.status === 'auto_confirmed' || m.status === 'user_confirmed').length})`,
            },
            {
              id: 'possible',
              label: `Possible — Confirm (${matches.filter((m) => m.status === 'suggested').length})`,
            },
            {
              id: 'unmatched',
              label: `Unmatched (${matches.filter((m) => m.status === 'unmatched').length})`,
            },
            {
              id: 'duplicates',
              label: `Duplicates (${duplicates.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <HinglishLoader message={LOADING_MESSAGES[language].reconciliation} />}

      {/* Matches List with Explainability Breakdown */}
      <div className="space-y-3">
        {filteredMatches.map((m) => {
          const txn = transactions.find((t) => t.id === m.bankTransactionId);
          const inv = invoices.find((i) => i.id === m.invoiceId);
          const isExpanded = expandedMatchId === m.id;
          if (!txn) return null;

          return (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="tabular-nums font-medium text-slate-800">{txn.date}</span>
                    <span>·</span>
                    <span className="font-mono">{txn.reference || 'NO-REF'}</span>
                    <span>·</span>
                    <StatusLabel status={txn.matchStatus} />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {txn.counterpartyName || txn.description} —{' '}
                    <span className="tabular-nums">
                      {txn.direction === 'in' ? '+' : '-'}
                      {formatINR(txn.amount)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {inv ? (
                      <>
                        Linked Bill: <strong>{inv.invoiceNumber}</strong> ({inv.customerName || inv.supplierName} · Bill Total {formatINR(inv.total)})
                      </>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        Ye payment kisi bill se match nahi ho rahi.
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-40">
                    <ConfidenceBar confidence={m.confidence} label="Match Score" />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {isExpanded ? 'Hide Why' : 'Why Score?'}
                    </button>
                    {(m.status === 'suggested' || m.status === 'unmatched') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDecision(txn.id, 'confirm', m.invoiceId)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Confirm Match
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(txn.id, 'reject', m.invoiceId)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Explainability Panel: Weighted Breakdown & Alternatives */}
              {isExpanded && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-800">
                    8-Signal Weighted Match Breakdown (Total: {m.confidence}/100)
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {m.reasons.map((r) => (
                      <div
                        key={r.signal}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>{r.label}</span>
                          <span className="tabular-nums">
                            {r.earned}/{r.weight}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600">{r.detail}</p>
                      </div>
                    ))}
                  </div>

                  {m.alternatives.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Ranked Alternative Candidate Invoices:
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {m.alternatives.map((alt) => (
                          <button
                            key={alt.invoiceId}
                            type="button"
                            onClick={() => handleDecision(txn.id, 'confirm', alt.invoiceId)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-emerald-600"
                          >
                            Re-assign to <strong>{alt.invoiceNumber}</strong> ({alt.partyName} ·{' '}
                            {formatINR(alt.invoiceTotal)} · {alt.confidence}%)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PaymentsAndInboxPage: React.FC<{
  mode: 'all' | 'inbox';
  language: Language;
  payments: Payment[];
  transactions: BankTransaction[];
  invoices: Invoice[];
  matches: ReconciliationMatch[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ mode, language, payments, transactions, invoices, matches, onRefreshState, onNavigate }) => {
  const [selectedInvoiceByTxn, setSelectedInvoiceByTxn] = useState<Record<string, string>>({});
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [partyName, setPartyName] = useState('Rahul Sharma');
  const [amount, setAmount] = useState(5000);
  const [direction, setDirection] = useState<'in' | 'out'>('in');

  const inboxTransactions = transactions.filter(
    (t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  );

  const handleInboxConfirm = async (txnId: string, decision: 'confirm' | 'reject') => {
    const chosenInvId = selectedInvoiceByTxn[txnId];
    await fetch('/api/reconciliation/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankTransactionId: txnId,
        decision,
        invoiceId: chosenInvId,
      }),
    });
    await onRefreshState();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction,
        partyType: direction === 'in' ? 'customer' : 'supplier',
        partyName,
        amount,
        method: 'UPI',
        source: 'manual',
      }),
    });
    setShowRecordModal(false);
    await onRefreshState();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'inbox'
              ? 'Payment Inbox (Unmatched & Possible Matches)'
              : 'Payments Ledger & Inbox'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {mode === 'inbox'
              ? 'Low-confidence (60–84%) and unmatched (<60%) bank transactions are never auto-assigned. Confirm or categorize here.'
              : 'Track all cash, UPI, and bank payments across customers and suppliers.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onNavigate('/payments')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Payments ({payments.length})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/payments/inbox')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mode === 'inbox' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Payment Inbox ({inboxTransactions.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowRecordModal(!showRecordModal)}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            + Record Payment
          </button>
        </div>
      </div>

      {showRecordModal && (
        <form
          onSubmit={handleRecordPayment}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900">Record Manual Cash / UPI Payment</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Party Name</label>
              <input
                type="text"
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Amount (₹)</label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="in">Money In (Customer Received)</option>
                <option value="out">Money Out (Supplier / Expense)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRecordModal(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Save Payment
            </button>
          </div>
        </form>
      )}

      {mode === 'inbox' ? (
        inboxTransactions.length === 0 ? (
          <EmptyStateCard title={EMPTY_MESSAGES[language].inbox} />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {inboxTransactions.map((txn) => {
              const m = matches.find((item) => item.bankTransactionId === txn.id);
              return (
                <div key={txn.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-amber-700">
                        {txn.matchStatus === 'possible'
                          ? 'POSSIBLE MATCH — PLEASE CONFIRM'
                          : 'UNMATCHED BANK ENTRY'}
                      </p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">
                        Ye {formatINR(txn.amount)} ka payment kisi bill se confidently match nahi ho raha.
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Date: <span className="tabular-nums">{txn.date}</span> · Counterparty:{' '}
                        <strong>{txn.counterpartyName || 'Unknown'}</strong> · Narration:{' '}
                        <span className="font-mono">{txn.description}</span>
                      </p>
                    </div>
                    <div className="w-40">
                      <ConfidenceBar confidence={m?.confidence || 42} label="Confidence" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700">Assign to Bill:</label>
                      <select
                        value={selectedInvoiceByTxn[txn.id] || m?.invoiceId || ''}
                        onChange={(e) =>
                          setSelectedInvoiceByTxn({
                            ...selectedInvoiceByTxn,
                            [txn.id]: e.target.value,
                          })
                        }
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="">General Account / Expense (No Bill)</option>
                        {invoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} — {inv.customerName || inv.supplierName} (
                            {formatINR(inv.total)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInboxConfirm(txn.id, 'confirm')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm &amp; Reconcile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInboxConfirm(txn.id, 'reject')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Skip / Keep Unmatched
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party Name</th>
                <th className="px-4 py-3">Method &amp; Ref</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 tabular-nums">{p.date}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{p.partyName || 'Counter'}</td>
                  <td className="px-4 py-3">
                    {p.method} {p.reference ? `· ${p.reference}` : ''}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.source.replace('_', ' ')}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-bold ${
                      p.direction === 'in' ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {p.direction === 'in' ? '+' : '-'}
                    {formatINR(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const CrossCheckStatementBillPage: React.FC<{
  language: Language;
  invoices: Invoice[];
  transactions: BankTransaction[];
  matches: ReconciliationMatch[];
  duplicates: DuplicateCandidate[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ language, invoices, transactions, matches, duplicates, onRefreshState, onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'verified' | 'mismatch' | 'missing'>('all');

  // Quick Bill Entry Form
  const [billParty, setBillParty] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billType, setBillType] = useState<'sale' | 'purchase'>('sale');

  // Quick Bank Statement Entry Form
  const [stmtParty, setStmtParty] = useState('');
  const [stmtUtr, setStmtUtr] = useState('');
  const [stmtAmount, setStmtAmount] = useState('');
  const [stmtDirection, setStmtDirection] = useState<'credit' | 'debit'>('credit');
  const [stmtDate, setStmtDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleUploadBillPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    setNotice('');
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      const scanRes = await fetch('/api/scan/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          imageBase64: base64Data,
          mimeType: file.type || 'image/jpeg',
        }),
      });
      const scanData = await scanRes.json();
      if (!scanRes.ok) {
        setErrorMsg(scanData.error || 'Bill scan failed');
        return;
      }

      // Automatically save extracted bill so it immediately cross-checks against bank statement
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: scanData.invoiceType || 'sale',
          invoiceNumber: scanData.invoiceNumber,
          billNumber: scanData.invoiceNumber,
          customerName: scanData.partyType === 'customer' ? scanData.partyName : undefined,
          supplierName: scanData.partyType === 'supplier' ? scanData.partyName : undefined,
          issueDate: scanData.issueDate,
          dueDate: scanData.dueDate || scanData.issueDate,
          total: scanData.total,
          paidAmount: 0,
          source: 'scan',
          ocrConfidence: scanData.overallConfidence,
          items: scanData.items,
          notes: 'Uploaded in Cross-Check Statement & Bill',
        }),
      });

      setNotice(
        `✓ Bill "${scanData.invoiceNumber}" (${scanData.partyName} · ${formatINR(scanData.total)}) extracted from photo and cross-checked with Bank Statement!`
      );
      await onRefreshState();
    } catch {
      setErrorMsg('Failed to process bill image.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleQuickAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(billAmount);
    if (!billParty.trim() || !amt || amt <= 0) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const invNum = billNo.trim() || `BILL-${Math.floor(100 + Math.random() * 900)}`;
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: billType,
          invoiceNumber: invNum,
          billNumber: invNum,
          customerName: billType === 'sale' ? billParty.trim() : undefined,
          supplierName: billType === 'purchase' ? billParty.trim() : undefined,
          total: amt,
          paidAmount: 0,
          source: 'manual',
          items: [
            {
              name: 'Bill Entry for Cross-Check',
              quantity: 1,
              unit: 'pcs',
              unitPrice: amt,
              lineTotal: amt,
            },
          ],
        }),
      });
      setBillParty('');
      setBillNo('');
      setBillAmount('');
      setNotice(`✓ Bill ${invNum} (${billParty.trim()} · ${formatINR(amt)}) added and cross-checked!`);
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleUploadStatementCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    setNotice('');
    try {
      const text = await file.text();
      const res = await fetch('/api/statements/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || ERROR_MESSAGES[language].unsupportedStatement);
        return;
      }
      setNotice(`✓ Bank Statement "${file.name}" (${data.parsedCount} entries) uploaded and cross-checked with Bills!`);
      await onRefreshState();
    } catch {
      setErrorMsg('Could not read bank statement file.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleQuickAddStatementEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(stmtAmount);
    if (!stmtParty.trim() || !amt || amt <= 0) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const utr = stmtUtr.trim() || `UTR${Math.floor(10000000 + Math.random() * 90000000)}`;
      const debit = stmtDirection === 'debit' ? amt : 0;
      const credit = stmtDirection === 'credit' ? amt : 0;
      const narration = `UPI/${utr}/${stmtParty.trim().toUpperCase()}/BILL`;
      const csvContent = `Date,Narration,Ref/UTR,Debit,Credit,Balance\n${stmtDate},${narration},${utr},${debit},${credit},${credit > 0 ? credit : 100000}`;

      const res = await fetch('/api/statements/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `Manual_Statement_${stmtDate}.csv`,
          content: csvContent,
        }),
      });
      if (res.ok) {
        setStmtParty('');
        setStmtUtr('');
        setStmtAmount('');
        setNotice(
          `✓ Bank Statement Entry (${stmtParty.trim()} · ${formatINR(amt)}) added and cross-checked against your Bills!`
        );
        await onRefreshState();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBillFromStatement = async (txn: BankTransaction) => {
    setLoading(true);
    try {
      const isSale = txn.credit > 0;
      const party = txn.counterpartyName || 'Bank Counterparty';
      const invNum = `BNK-${txn.reference?.slice(-4) || Math.floor(100 + Math.random() * 900)}`;
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isSale ? 'sale' : 'purchase',
          invoiceNumber: invNum,
          billNumber: invNum,
          customerName: isSale ? party : undefined,
          supplierName: !isSale ? party : undefined,
          issueDate: txn.date,
          dueDate: txn.date,
          total: txn.amount,
          paidAmount: txn.amount,
          source: 'manual',
          items: [
            {
              name: `Matched to Bank Ref ${txn.reference || txn.description}`,
              quantity: 1,
              unit: 'pcs',
              unitPrice: txn.amount,
              lineTotal: txn.amount,
            },
          ],
        }),
      });
      setNotice(`✓ Created & Verified Bill ${invNum} (${party} · ${formatINR(txn.amount)}) from Bank Statement!`);
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLink = async (bankTransactionId: string, invoiceId: string) => {
    setLoading(true);
    try {
      await fetch('/api/reconciliation/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId, decision: 'confirm', invoiceId }),
      });
      setNotice('✓ Statement entry linked and verified with Bill!');
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  // Compute Cross-Check pairings between every Bill (Invoice) and Bank Transactions
  const crossCheckedBills = invoices.map((inv) => {
    const partyName = (inv.customerName || inv.supplierName || 'Customer').trim();
    const expectedDirection = inv.type === 'sale' ? 'credit' : 'debit';

    // 1. Check if already linked via reconciliationMatches
    const reconMatch = matches.find((m) => m.invoiceId === inv.id);
    let matchedTxn = reconMatch
      ? transactions.find((t) => t.id === reconMatch.bankTransactionId)
      : undefined;

    // 2. If not linked yet, look for best matching transaction by party name, invoice number, or exact amount
    if (!matchedTxn) {
      matchedTxn = transactions.find((t) => {
        const dirOk = expectedDirection === 'credit' ? t.credit > 0 : t.debit > 0;
        if (!dirOk) return false;
        const pLower = partyName.toLowerCase();
        const tParty = (t.counterpartyName || t.description || '').toLowerCase();
        const nameMatch =
          pLower.length >= 3 &&
          (tParty.includes(pLower) ||
            pLower.split(/\s+/).some((w) => w.length >= 3 && tParty.includes(w)));
        const invNoMatch =
          inv.invoiceNumber &&
          t.description.toLowerCase().includes(inv.invoiceNumber.toLowerCase());
        const exactAmtMatch = Math.abs(t.amount - inv.total) < 1;
        return (nameMatch && exactAmtMatch) || invNoMatch || nameMatch || exactAmtMatch;
      });
    }

    let checkStatus: 'verified' | 'mismatch' | 'missing' = 'missing';
    let diffAmount = 0;

    if (matchedTxn) {
      diffAmount = matchedTxn.amount - inv.total;
      if (Math.abs(diffAmount) < 1) {
        checkStatus = 'verified';
      } else {
        checkStatus = 'mismatch';
      }
    } else if (inv.status === 'paid' && inv.paidAmount >= inv.total) {
      checkStatus = 'verified';
    }

    return {
      invoice: inv,
      partyName,
      matchedTxn,
      checkStatus,
      diffAmount,
    };
  });

  const matchedTxnIds = new Set(
    crossCheckedBills.map((c) => c.matchedTxn?.id).filter(Boolean) as string[]
  );
  const unbilledTransactions = transactions.filter((t) => !matchedTxnIds.has(t.id));

  const verifiedCount = crossCheckedBills.filter((c) => c.checkStatus === 'verified').length;
  const mismatchCount =
    crossCheckedBills.filter((c) => c.checkStatus === 'mismatch').length + duplicates.length;
  const missingInBankCount = crossCheckedBills.filter((c) => c.checkStatus === 'missing').length;

  const filteredBillRows = crossCheckedBills.filter((row) => {
    if (filterMode === 'all') return true;
    return row.checkStatus === filterMode;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#082F5E]">
            BILL SE BANK TAK, SAARA HISAB EK JAGAH
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
            Cross-Check Bank Statement &amp; Bill
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Apne Bills aur Bank Statement ko side-by-side milayein — dekhein kaunsa bill bank mein aaya, kis mein farak (mismatch) hai, aur kaunsi entry bina bill ke hai.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/scan')}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            📷 Open Full Bill Scanner
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/reconciliation')}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            8-Signal Details →
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {notice}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {errorMsg}
        </div>
      )}

      {loading && <HinglishLoader message="Bill aur Bank Statement cross-check ho raha hai..." />}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Total Bills vs Bank Entries</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-slate-900">
            {invoices.length} Bills · {transactions.length} Bank Txns
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-xs font-bold text-emerald-800">✓ Verified &amp; Matched</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-emerald-700">
            {verifiedCount} Bills Matched
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-xs font-bold text-amber-800">⚠️ Amount Mismatch / Duplicate</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-amber-700">
            {mismatchCount} Found
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
          <p className="text-xs font-bold text-red-800">❌ Missing (No Bank / No Bill)</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-red-700">
            {missingInBankCount} Bills · {unbilledTransactions.length} Bank
          </p>
        </div>
      </div>

      {/* Side-by-Side Upload & Quick Entry Boxes: Step 1 (Bill) & Step 2 (Bank Statement) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Box: Add or Upload Bill */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                STEP 1 · BILL / INVOICE
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Upload Bill Photo or Enter Bill to Cross-Check
              </h2>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#00966B] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#007F5A]">
              <Camera className="h-4 w-4" />
              <span>Upload Bill Photo (JPEG/PNG)</span>
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp"
                onChange={handleUploadBillPhoto}
                className="hidden"
              />
            </label>
          </div>

          <form onSubmit={handleQuickAddBill} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600">
                Party Name (Customer/Vendor)
              </label>
              <input
                type="text"
                required
                value={billParty}
                onChange={(e) => setBillParty(e.target.value)}
                placeholder="e.g. Tanmay / Ramesh"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600">Bill No (Optional)</label>
              <input
                type="text"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                placeholder="e.g. INV-101"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600">Bill Amount (₹)</label>
              <input
                type="number"
                required
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="43000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold tabular-nums"
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2 px-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                + Add Bill
              </button>
            </div>
            <div className="sm:col-span-12 flex items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={billType === 'sale'}
                  onChange={() => setBillType('sale')}
                />
                <span>Customer Sale / Fee Receipt</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={billType === 'purchase'}
                  onChange={() => setBillType('purchase')}
                />
                <span>Supplier Purchase Bill</span>
              </label>
            </div>
          </form>
        </div>

        {/* Right Box: Add or Upload Bank Statement */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700">
                STEP 2 · BANK STATEMENT
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Upload Statement CSV or Add Bank Entry to Cross-Check
              </h2>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Upload className="h-4 w-4" />
              <span>Upload Statement CSV</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.pdf"
                onChange={handleUploadStatementCsv}
                className="hidden"
              />
            </label>
          </div>

          <form
            onSubmit={handleQuickAddStatementEntry}
            className="grid grid-cols-1 gap-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600">
                Bank Narration / Party
              </label>
              <input
                type="text"
                required
                value={stmtParty}
                onChange={(e) => setStmtParty(e.target.value)}
                placeholder="e.g. Tanmay / Ramesh"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600">UTR / Ref No</label>
              <input
                type="text"
                value={stmtUtr}
                onChange={(e) => setStmtUtr(e.target.value)}
                placeholder="e.g. 41299100"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600">Bank Amount (₹)</label>
              <input
                type="number"
                required
                value={stmtAmount}
                onChange={(e) => setStmtAmount(e.target.value)}
                placeholder="43000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-bold tabular-nums"
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2 px-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                + Add Entry
              </button>
            </div>
            <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={stmtDirection === 'credit'}
                    onChange={() => setStmtDirection('credit')}
                  />
                  <span>Credit (Money Received In Bank)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={stmtDirection === 'debit'}
                    onChange={() => setStmtDirection('debit')}
                  />
                  <span>Debit (Money Paid Out)</span>
                </label>
              </div>
              <input
                type="date"
                value={stmtDate}
                onChange={(e) => setStmtDate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All Bills (${crossCheckedBills.length})` },
              { id: 'verified', label: `✓ Verified (${verifiedCount})` },
              { id: 'mismatch', label: `⚠️ Amount Mismatch (${mismatchCount})` },
              { id: 'missing', label: `❌ Missing in Bank (${missingInBankCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                filterMode === tab.id
                  ? 'bg-[#00966B] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Side-by-Side Comparison Table: BILL vs BANK STATEMENT */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            1. Bill vs Bank Statement Cross-Check Matrix ({filteredBillRows.length})
          </h3>
          <span className="text-xs text-slate-500">
            Compares Party Name, Bill #, Date &amp; Exact Rupee Amount
          </span>
        </div>

        {filteredBillRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-bold text-slate-800">
              Abhi cross-check ke liye koi Bill nahi hai
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Upar Step 1 mein Bill Photo upload karein ya "+ Add Bill" se bill add karein, aur Step 2 mein Bank Statement entry daalein.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Bill Details (Hisab Kitab)</th>
                  <th className="px-4 py-3 text-right">Bill Amount</th>
                  <th className="px-4 py-3">Matching Bank Statement Entry</th>
                  <th className="px-4 py-3 text-right">Bank Amount</th>
                  <th className="px-4 py-3">Cross-Check Result</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBillRows.map(({ invoice, partyName, matchedTxn, checkStatus, diffAmount }) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">
                        {partyName} ·{' '}
                        <span className="font-mono text-slate-600">{invoice.invoiceNumber}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Date: {invoice.issueDate} · {invoice.type === 'sale' ? 'Sale Bill' : 'Purchase Bill'} · Source: {invoice.source}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-slate-900">
                      {formatINR(invoice.total)}
                    </td>
                    <td className="px-4 py-3.5">
                      {matchedTxn ? (
                        <div>
                          <p className="font-semibold text-slate-900">
                            {matchedTxn.counterpartyName || 'Bank Entry'} ·{' '}
                            <span className="font-mono text-[11px] text-slate-500">
                              UTR: {matchedTxn.reference || 'N/A'}
                            </span>
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 truncate max-w-xs">
                            {matchedTxn.date} · {matchedTxn.description}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">
                          No matching entry found in Bank Statement
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold">
                      {matchedTxn ? (
                        <span
                          className={
                            checkStatus === 'verified' ? 'text-emerald-700' : 'text-amber-700'
                          }
                        >
                          {formatINR(matchedTxn.amount)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {checkStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Verified (Bill = Bank)</span>
                        </span>
                      ) : checkStatus === 'mismatch' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                              Amount Diff:{' '}
                              {diffAmount > 0
                                ? `+${formatINR(diffAmount)} Extra`
                                : `${formatINR(Math.abs(diffAmount))} Short`}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-600">
                          <X className="h-4 w-4 shrink-0" />
                          <span>Missing in Bank (Pending)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {matchedTxn && matchedTxn.matchStatus !== 'matched' ? (
                        <button
                          type="button"
                          onClick={() => handleConfirmLink(matchedTxn.id, invoice.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Confirm Match
                        </button>
                      ) : checkStatus === 'missing' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStmtParty(partyName);
                            setStmtAmount(String(invoice.total));
                            setStmtDirection(invoice.type === 'sale' ? 'credit' : 'debit');
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Fill in Step 2 ↑
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">✓ Matched</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Bank Statement Entries that have NO Bill in Hisab Kitab */}
      {unbilledTransactions.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-white overflow-hidden">
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3.5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                2. Bank Statement Entries Without Any Matching Bill ({unbilledTransactions.length})
              </h3>
              <p className="text-xs text-amber-800">
                Yeh entries aapke Bank Statement mein hain lekin inka koi Bill abhi tak Hisab Kitab mein nahi bana hai.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Bank Date</th>
                  <th className="px-4 py-3">Counterparty &amp; Narration</th>
                  <th className="px-4 py-3">UTR / Ref</th>
                  <th className="px-4 py-3 text-right">Bank Amount</th>
                  <th className="px-4 py-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {unbilledTransactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="px-4 py-3 tabular-nums font-medium">{txn.date}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">
                        {txn.counterpartyName || 'Unidentified Party'}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">{txn.description}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{txn.reference || '—'}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-bold ${
                        txn.credit > 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {txn.credit > 0 ? `+${formatINR(txn.credit)}` : `-${formatINR(txn.debit)}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleCreateBillFromStatement(txn)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#00966B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#007F5A]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create Matching Bill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
