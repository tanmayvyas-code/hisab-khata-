import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Package,
  Plus,
  Send,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  Alert,
  CollectFirstItem,
  Customer,
  InventoryItem,
  Invoice,
  Language,
  Payment,
  Product,
  Reminder,
  StockMovement,
  Supplier,
  SupplierPriceInsight,
} from '../types/domain';
import {
  EMPTY_MESSAGES,
  formatINR,
  REMINDER_DRAFT_DISCLAIMER,
  UI_DICT,
} from '../i18n/translations';
import { generateReminderDraft } from '../engines/lostMoneyEngine';
import { EmptyStateCard, StatusLabel } from './ui';

export const CustomersAndDetailPage: React.FC<{
  selectedCustomerId?: string;
  language: Language;
  shopName: string;
  customers: Customer[];
  collections: CollectFirstItem[];
  invoices: Invoice[];
  payments: Payment[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({
  selectedCustomerId,
  language,
  shopName,
  customers,
  collections,
  invoices,
  payments,
  onRefreshState,
  onNavigate,
}) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newOpeningBal, setNewOpeningBal] = useState(0);

  const [tone, setTone] = useState<'polite' | 'firm' | 'final'>('firm');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [savedReminderBanner, setSavedReminderBanner] = useState('');

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        mobile: newMobile,
        openingBalance: newOpeningBal,
      }),
    });
    setNewName('');
    setNewMobile('');
    setNewOpeningBal(0);
    setShowAddCustomer(false);
    await onRefreshState();
  };

  if (selectedCustomerId) {
    const cust = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    if (!cust) {
      return (
        <EmptyStateCard
          title="Customer not found"
          actionLabel="Back to Customers"
          onAction={() => onNavigate('/customers')}
        />
      );
    }

    const col = collections.find((c) => c.customerId === cust.id);
    const outstanding = col?.outstandingAmount || cust.openingBalance || 0;
    const daysOverdue = col?.daysOverdue || 0;
    const custInvoices = invoices.filter((i) => i.customerId === cust.id);
    const custPayments = payments.filter((p) => p.partyId === cust.id);

    const draftText = generateReminderDraft(
      cust.name,
      shopName,
      outstanding || 1000,
      daysOverdue || 7,
      tone,
      language
    );

    const handleSaveReminderRecord = async (status: 'draft' | 'copied' | 'marked_sent') => {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: cust.id,
          channel,
          tone,
          status,
        }),
      });
      setSavedReminderBanner(`✓ Reminder draft (${tone}) saved as ${status.replace('_', ' ')}.`);
      await onRefreshState();
    };

    const waUrl = `https://wa.me/91${(cust.mobile || '9829011223').replace(/\D/g, '')}?text=${encodeURIComponent(
      draftText
    )}`;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/customers')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Customers</span>
          </button>
          <span className="text-xs text-slate-500">Customer Khata &amp; Behaviour Dossier</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{cust.name}</h1>
              <p className="mt-1 text-xs text-slate-600">
                Mobile: <span className="tabular-nums">{cust.mobile || '—'}</span> · Address:{' '}
                {cust.address || 'Jaipur'} · Avg Delay:{' '}
                <strong className="tabular-nums">{cust.averageDelayDays} days</strong> · Promises Kept:{' '}
                <strong className="tabular-nums">{Math.round(cust.promisesKeptRatio * 100)}%</strong>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold text-slate-500">
                {UI_DICT[language].receivablesLabel}
              </p>
              <p className="tabular-nums text-3xl font-bold text-amber-700">
                {formatINR(outstanding)}
              </p>
              {daysOverdue > 0 && (
                <p className="text-xs font-semibold text-red-700">
                  {daysOverdue} days overdue
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Smart Reminder Generator Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-700">SMART COLLECTION REMINDER</p>
              <h2 className="text-base font-bold text-slate-900">
                Generate WhatsApp / SMS / Email Draft for {cust.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-1">
                {(['polite', 'firm', 'final'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold capitalize ${
                      tone === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-slate-100 p-1">
                {(['whatsapp', 'sms', 'email'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${
                      channel === ch ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {savedReminderBanner && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {savedReminderBanner}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
            {draftText}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{REMINDER_DRAFT_DISCLAIMER}</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(draftText);
                  setCopiedDraft(true);
                  handleSaveReminderRecord('copied');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copiedDraft ? 'Copied Draft!' : 'Copy Message'}</span>
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleSaveReminderRecord('marked_sent')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in WhatsApp (wa.me)</span>
              </a>
              <button
                type="button"
                onClick={() => handleSaveReminderRecord('marked_sent')}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Mark as Sent
              </button>
            </div>
          </div>
        </div>

        {/* Customer Ledger Timeline */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900">
              Invoices Billed to {cust.name} ({custInvoices.length})
            </h3>
            <div className="mt-3 divide-y divide-slate-100">
              {custInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{inv.invoiceNumber}</p>
                    <p className="text-slate-500">
                      Issued: {inv.issueDate} · Due: {inv.dueDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-bold text-slate-900">{formatINR(inv.total)}</p>
                    <StatusLabel status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900">
              Payments Received ({custPayments.length})
            </h3>
            {custPayments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No recent payments received against open invoice.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {custPayments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {p.method} {p.reference ? `(${p.reference})` : ''}
                      </p>
                      <p className="text-slate-500">{p.date}</p>
                    </div>
                    <p className="tabular-nums font-bold text-emerald-700">+{formatINR(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers &amp; Priority Recovery</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Click any customer to open their khata timeline, payment behaviour, and reminder generator.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/customers/cust-rahul')}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
          >
            “Rahul ka khata dikhao” (₹42,000)
          </button>
          <button
            type="button"
            onClick={() => setShowAddCustomer(!showAddCustomer)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {showAddCustomer && (
        <form
          onSubmit={handleAddCustomer}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900">Add New Customer</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Customer Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Mahesh Provision Store"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Mobile Number</label>
              <input
                type="text"
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                placeholder="98290XXXXX"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Opening Udhaar Balance (₹)
              </label>
              <input
                type="number"
                value={newOpeningBal}
                onChange={(e) => setNewOpeningBal(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddCustomer(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Save Customer
            </button>
          </div>
        </form>
      )}

      {customers.length === 0 ? (
        <EmptyStateCard
          title={EMPTY_MESSAGES[language].customers}
          actionLabel="+ Add First Customer"
          onAction={() => setShowAddCustomer(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {customers.map((c) => {
            const col = collections.find((item) => item.customerId === c.id);
            const balance = col?.outstandingAmount || c.openingBalance || 0;
            const overdue = col?.daysOverdue || 0;

            return (
              <div
                key={c.id}
                onClick={() => onNavigate(`/customers/${c.id}`)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 hover:border-emerald-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{c.name}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {c.mobile || 'No mobile'} · Avg delay: {c.averageDelayDays}d · Promises kept:{' '}
                      {Math.round(c.promisesKeptRatio * 100)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-lg font-bold text-slate-900">
                      {formatINR(balance)}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        overdue >= 40
                          ? 'text-red-700'
                          : overdue > 0
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {overdue > 0 ? `${overdue} days overdue` : 'Settled / On time'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">{c.notes || 'Regular shop customer'}</span>
                  <span className="font-semibold text-emerald-700">Open Khata &amp; Reminder →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const KhataOverviewPage: React.FC<{
  language: Language;
  customers: Customer[];
  suppliers: Supplier[];
  collections: CollectFirstItem[];
  invoices: Invoice[];
  onNavigate: (path: string) => void;
}> = ({ language, customers, suppliers, collections, invoices, onNavigate }) => {
  const totalToReceive = collections.reduce((s, c) => s + c.outstandingAmount, 0);
  const totalSupplierCreditNotes = invoices
    .filter((i) => i.status === 'overpaid' || i.status === 'duplicate')
    .reduce((s, i) => s + Math.max(0, i.paidAmount - i.total), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Khata Ledger Overview (Kisko Kitna Dena / Lena Hai)
        </h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Plain-language summary of customer receivables and supplier balances.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold text-amber-700 uppercase">
            {UI_DICT[language].receivablesLabel}
          </p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-slate-900">
            {formatINR(totalToReceive)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Across {collections.length} customers with open udhaar bills (₹42,000 high-priority + ₹25,700 follow-up)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold text-emerald-700 uppercase">
            Supplier Excess / Credit Notes Recoverable
          </p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-emerald-700">
            {formatINR(totalSupplierCreditNotes)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Gupta Traders (₹18,500 duplicate) + Shree Balaji Hardware (₹7,000 overpayment)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">
            Customer Udhaar Ranking (Collect First)
          </h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Priority Rank</th>
              <th className="px-4 py-3">Customer Name</th>
              <th className="px-4 py-3">Days Overdue</th>
              <th className="px-4 py-3">Recovery Bucket</th>
              <th className="px-4 py-3 text-right">Amount to Collect</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {collections.map((col) => (
              <tr key={col.customerId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold tabular-nums">#{col.rank}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{col.customerName}</td>
                <td className="px-4 py-3 tabular-nums font-medium text-red-700">
                  {col.daysOverdue} days
                </td>
                <td className="px-4 py-3">
                  {col.tier === 'critical_recovery' ? (
                    <span className="font-semibold text-red-700">Hero High-Priority (&ge;40d)</span>
                  ) : (
                    <span className="text-slate-600">Follow-up Receivable</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                  {formatINR(col.outstandingAmount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/customers/${col.customerId}`)}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Open Khata &amp; Remind →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const InvoicesPage: React.FC<{
  mode: 'list' | 'new';
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ mode, invoices, customers, products, onRefreshState, onNavigate }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerName, setCustomerName] = useState(customers[0]?.name || 'Ramesh Kumar');
  const [invoiceType, setInvoiceType] = useState<'sale' | 'purchase'>('sale');
  const [itemName, setItemName] = useState(products[0]?.name || 'Sona Masoori Rice');
  const [qty, setQty] = useState(10);
  const [unitPrice, setUnitPrice] = useState(60);
  const [gstRate, setGstRate] = useState(5);
  const [paidNow, setPaidNow] = useState(0);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: invoiceType,
        customerName: invoiceType === 'sale' ? customerName : undefined,
        supplierName: invoiceType === 'purchase' ? customerName : undefined,
        paidAmount: paidNow,
        source: 'manual',
        items: [
          {
            name: itemName,
            quantity: qty,
            unit: 'kg',
            unitPrice,
            gstRate,
          },
        ],
      }),
    });
    await onRefreshState();
    onNavigate('/invoices');
  };

  if (mode === 'new') {
    const subtotal = qty * unitPrice;
    const gstAmt = Math.round(subtotal * (gstRate / 100));
    const grandTotal = subtotal + gstAmt;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Create New GST / Sale Bill</h1>
          <button
            type="button"
            onClick={() => onNavigate('/invoices')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Invoices
          </button>
        </div>

        <form
          onSubmit={handleCreateInvoice}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Bill Type</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as 'sale' | 'purchase')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="sale">Sale Bill (Customer)</option>
                <option value="purchase">Purchase Bill (Supplier)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Customer / Supplier Name
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Amount Received Now (₹)
              </label>
              <input
                type="number"
                value={paidNow}
                onChange={(e) => setPaidNow(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 border-t border-slate-200 pt-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Product / Item</label>
              <input
                type="text"
                list="product-options"
                required
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  const found = products.find((p) => p.name === e.target.value);
                  if (found) setUnitPrice(found.sellingPrice);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <datalist id="product-options">
                {products.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Quantity</label>
              <input
                type="number"
                required
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Rate (₹)</label>
              <input
                type="number"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-slate-200 pt-4">
            <div className="text-sm">
              Subtotal: <strong className="tabular-nums">{formatINR(subtotal)}</strong> · GST (
              {gstRate}%): <strong className="tabular-nums">{formatINR(gstAmt)}</strong> · Grand Total:{' '}
              <strong className="tabular-nums text-lg text-emerald-700">
                {formatINR(grandTotal)}
              </strong>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Confirm &amp; Create Bill
            </button>
          </div>
        </form>
      </div>
    );
  }

  const filtered = invoices.filter((i) =>
    statusFilter === 'all' ? true : i.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices &amp; Purchase Bills</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Every sale and purchase bill with linked bank reconciliation status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/scan')}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            📷 Scan Bill
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/invoices/new')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {['all', 'paid', 'unpaid', 'partial', 'overpaid', 'duplicate'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
              statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Party Name</th>
              <th className="px-4 py-3">Issue / Due Date</th>
              <th className="px-4 py-3 text-right">Bill Total</th>
              <th className="px-4 py-3 text-right">Paid Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                  {inv.invoiceNumber}
                </td>
                <td className="px-4 py-3 capitalize">{inv.type}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {inv.customerName || inv.supplierName}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  {inv.issueDate} → {inv.dueDate}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                  {formatINR(inv.total)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatINR(inv.paidAmount)}
                </td>
                <td className="px-4 py-3">
                  <StatusLabel status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const InventoryAndSuppliersPage: React.FC<{
  mode: 'inventory' | 'suppliers';
  products: Product[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  supplierInsights: SupplierPriceInsight[];
  onNavigate: (path: string) => void;
}> = ({ mode, products, inventory, stockMovements, suppliers, supplierInsights, onNavigate }) => {
  const totalStockValue = inventory.reduce((s, i) => s + i.stockValue, 0);
  const lowStockCount = inventory.filter((i) => i.quantity <= i.reorderLevel).length;

  if (mode === 'suppliers') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Suppliers &amp; Price Intelligence
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Compares per-product rates across suppliers so you never overpay on staples.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/inventory')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Stock Inventory →
          </button>
        </div>

        {/* Supplier Price Gap Insight Cards (§8.9) */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            AI Munim Supplier Rate Gap Insights
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {supplierInsights.map((sp) => (
              <div key={sp.productId} className="rounded-xl border border-amber-300 bg-white p-5">
                <p className="text-xs font-bold text-amber-800">
                  SAVE MONEY · SUPPLIER PRICE INTELLIGENCE
                </p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{sp.explanation}</h3>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <p className="text-slate-500">Current Rate</p>
                    <p className="mt-0.5 tabular-nums font-bold text-red-700">
                      ₹{sp.currentPrice}/{sp.unit}
                    </p>
                    <p className="text-[11px] text-slate-500">{sp.currentSupplierName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cheapest Rate</p>
                    <p className="mt-0.5 tabular-nums font-bold text-emerald-700">
                      ₹{sp.cheapestPrice}/{sp.unit}
                    </p>
                    <p className="text-[11px] text-slate-500">{sp.cheapestSupplierName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Monthly Saving Est.</p>
                    <p className="mt-0.5 tabular-nums font-bold text-slate-900">
                      {formatINR(sp.estimatedMonthlySaving)}/mo
                    </p>
                    <p className="text-[11px] text-slate-500">
                      on {sp.monthlyVolume} {sp.unit}/mo
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Registered Suppliers ({suppliers.length})</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {suppliers.map((sup) => (
              <div key={sup.id} className="p-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{sup.name}</h3>
                  <p className="text-xs text-slate-500">
                    Contact: {sup.contact} · GSTIN: {sup.gstin || '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{sup.notes}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory &amp; Stock Intelligence</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Automatically updates from confirmed voice, scanned, and manual bills.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/suppliers')}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Supplier Price Intelligence →
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Stock Valuation</p>
          <p className="mt-1 tabular-nums text-2xl font-bold text-slate-900">
            {formatINR(totalStockValue)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <p className="text-xs font-bold text-amber-800">Low Stock Items Requiring Reorder</p>
          <p className="mt-1 tabular-nums text-2xl font-bold text-amber-900">
            {lowStockCount} Products
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Tracked SKUs</p>
          <p className="mt-1 tabular-nums text-2xl font-bold text-slate-900">
            {products.length} Active Items
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Product Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Current Stock</th>
              <th className="px-4 py-3 text-right">Cost / Sell Price</th>
              <th className="px-4 py-3 text-right">Stock Value</th>
              <th className="px-4 py-3">Velocity &amp; Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {inventory.map((item) => {
              const prod = products.find((p) => p.id === item.productId);
              if (!prod) return null;
              const isLow = item.quantity <= item.reorderLevel;
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{prod.name}</td>
                  <td className="px-4 py-3 text-slate-600">{prod.category}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    {item.quantity} {prod.unit}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    ₹{prod.costPrice} / ₹{prod.sellingPrice}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                    {formatINR(item.stockValue)}
                  </td>
                  <td className="px-4 py-3">
                    {isLow ? (
                      <span className="font-semibold text-amber-700">
                        ⚠ Low Stock (Reorder &le; {item.reorderLevel} {prod.unit})
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium capitalize">
                        ✓ In Stock · {item.velocity} moving
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AlertsAndRemindersPage: React.FC<{
  mode: 'alerts' | 'reminders';
  language: Language;
  shopName: string;
  alerts: Alert[];
  reminders: Reminder[];
  collections: CollectFirstItem[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ mode, language, shopName, alerts, reminders, collections, onRefreshState, onNavigate }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<'polite' | 'firm' | 'final'>('firm');

  const handleAlertStatus = async (alertId: string, status: 'resolved' | 'dismissed') => {
    await fetch('/api/alerts/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, status }),
    });
    await onRefreshState();
  };

  if (mode === 'alerts') {
    const visibleAlerts = alerts.filter((a) => a.status !== 'dismissed');
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts Center</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Prioritized by severity and ₹ at stake across duplicates, overdue collections, loan readiness &amp; stock.
          </p>
        </div>

        {visibleAlerts.length === 0 ? (
          <EmptyStateCard title={EMPTY_MESSAGES[language].alerts} />
        ) : (
          <div className="space-y-3">
            {visibleAlerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-bold uppercase ${
                          a.severity === 'critical'
                            ? 'text-red-700'
                            : a.severity === 'high'
                              ? 'text-amber-700'
                              : 'text-blue-700'
                        }`}
                      >
                        {a.severity}
                      </span>
                      {a.amountAtStake && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums font-bold text-slate-900">
                            At Stake: {formatINR(a.amountAtStake)}
                          </span>
                        </>
                      )}
                      {a.status === 'resolved' && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-emerald-700">✓ Resolved</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 text-base font-bold text-slate-900">{a.title}</h2>
                    <p className="mt-1 text-xs text-slate-600">{a.body}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate(a.actionRoute)}
                      className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Open &amp; Fix →
                    </button>
                    {a.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => handleAlertStatus(a.id, 'resolved')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAlertStatus(a.id, 'dismissed')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Smart Collection Recovery &amp; Reminder Drafts
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">{REMINDER_DRAFT_DISCLAIMER}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Tone:</span>
          <div className="flex rounded-lg bg-slate-100 p-1">
            {(['polite', 'firm', 'final'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTone(t)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize ${
                  selectedTone === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {collections.map((col) => {
          const draft = generateReminderDraft(
            col.customerName,
            shopName,
            col.outstandingAmount,
            col.daysOverdue,
            selectedTone,
            language
          );
          const waLink = `https://wa.me/91${(col.mobile || '9829011223').replace(/\D/g, '')}?text=${encodeURIComponent(
            draft
          )}`;

          return (
            <div key={col.customerId} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-emerald-700">
                    COLLECT FIRST PRIORITY #{col.rank}
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    {col.customerName} — <span className="tabular-nums">{formatINR(col.outstandingAmount)}</span>{' '}
                    ({col.daysOverdue} days overdue)
                  </h2>
                  <p className="text-xs text-slate-500">{col.reason}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(draft);
                      setCopiedId(col.customerId);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copiedId === col.customerId ? 'Copied!' : 'Copy Draft'}</span>
                  </button>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open WhatsApp</span>
                  </a>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                {draft}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
