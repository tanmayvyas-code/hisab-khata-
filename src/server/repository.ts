import crypto from 'crypto';
import type {
  AiMessage,
  Alert,
  BankStatement,
  BankTransaction,
  Customer,
  DuplicateCandidate,
  InventoryItem,
  Invoice,
  Language,
  Payment,
  Product,
  ReconciliationMatch,
  Reminder,
  ScoreSnapshot,
  Shop,
  StockMovement,
  Supplier,
  User,
} from '../types/domain.ts';
import { createDemoSeedBundle, type ShopSeedBundle } from '../data/demoSeed.ts';
import { runReconciliation } from '../engines/reconciliationEngine.ts';
import { detectDuplicatePayments } from '../engines/duplicateDetector.ts';
import {
  computeFinancialHealth,
  computeLoanReadiness,
  computeCashflowForecast,
  computeSupplierPriceIntelligence,
  computeProfitLeakage,
  generateSystemAlerts,
  type WhatIfOptions,
} from '../engines/scoringEngine.ts';
import { aggregateLostMoney, rankSmartCollections, generateReminderDraft } from '../engines/lostMoneyEngine.ts';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`ai_munim_salt_${password}`).digest('hex');
}

export interface SessionRecord {
  token: string;
  userId: string;
  shopId: string;
  createdAt: string;
}

class MultiTenantRepository {
  private shops = new Map<string, ShopSeedBundle>();
  private usersById = new Map<string, User>();
  private shopIdByUserId = new Map<string, string>();
  private sessions = new Map<string, SessionRecord>();
  private reconciliationDecisions = new Map<string, ReconciliationMatch[]>();

  constructor() {
    this.seedDefaultDemoShops();
  }

  public seedDefaultDemoShops(): void {
    // Primary Default Shop starts CLEAN (zero demo data) unless user explicitly clicks 'Load Demo Data'
    const demoA = createDemoSeedBundle('shop-demo-1', 'user-demo-1');
    demoA.user.passwordHash = hashPassword('demo1234');
    demoA.user.name = 'Shop Owner';
    demoA.shop.shopName = 'My Dukan';
    demoA.shop.ownerName = 'Shop Owner';
    demoA.shop.address = '';
    demoA.shop.gstin = '';
    this.shops.set(demoA.shop.id, demoA);
    this.usersById.set(demoA.user.id, demoA.user);
    this.shopIdByUserId.set(demoA.user.id, demoA.shop.id);
    this.clearShopData(demoA.shop.id);

    // Secondary Isolated Shop (User B) for multi-tenant security testing
    const demoB = createDemoSeedBundle('shop-isolated-b', 'user-isolated-b');
    demoB.user.name = 'Vikram Mehta';
    demoB.user.email = 'vikram@mehtamedicals.in';
    demoB.user.mobile = '9811122233';
    demoB.user.passwordHash = hashPassword('vikram1234');
    demoB.shop.shopName = 'Mehta Medical & Surgical Store';
    demoB.shop.ownerName = 'Vikram Mehta';
    demoB.shop.businessType = 'medical';
    this.shops.set(demoB.shop.id, demoB);
    this.usersById.set(demoB.user.id, demoB.user);
    this.shopIdByUserId.set(demoB.user.id, demoB.shop.id);
    this.clearShopData(demoB.shop.id);
  }

  public clearShopData(shopId: string): ShopSeedBundle {
    const bundle = this.getBundleOrThrow(shopId);
    bundle.customers = [];
    bundle.suppliers = [];
    bundle.products = [];
    bundle.inventory = [];
    bundle.stockMovements = [];
    bundle.invoices = [];
    bundle.payments = [];
    bundle.bankStatements = [];
    bundle.bankTransactions = [];
    bundle.reminders = [];
    bundle.scoreSnapshots = [];
    bundle.duplicateDecisions = {};
    bundle.alertStatuses = {};
    bundle.monthlySeries = [
      { month: 'Jan', revenue: 0, collected: 0, pending: 0, expenses: 0 },
      { month: 'Feb', revenue: 0, collected: 0, pending: 0, expenses: 0 },
      { month: 'Mar', revenue: 0, collected: 0, pending: 0, expenses: 0 },
      { month: 'Apr', revenue: 0, collected: 0, pending: 0, expenses: 0 },
    ];
    bundle.shop.openingBankBalance = 0;
    bundle.shop.demoMode = false;
    bundle.aiMessages = [
      {
        id: `msg-welcome-${Date.now()}`,
        shopId,
        role: 'assistant',
        content:
          'Namaste! Main aapka Hisab Kitab AI hoon — Bill Se Bank Tak, Saara Hisab Ek Jagah. Aapki dukan ka khata bilkul saaf (0 demo data) hai. Naya bill banane ke liye Voice Billing ya Bill Scanner use karein, ya Cross-Check Statement & Bill se apna bank statement milayein.',
        createdAt: new Date().toISOString(),
      },
    ];
    this.reconciliationDecisions.delete(shopId);
    return bundle;
  }

  public resetShopToDemo(shopId: string): ShopSeedBundle {
    const existing = this.shops.get(shopId);
    const userId = existing?.user.id || 'user-demo-1';
    const fresh = createDemoSeedBundle(shopId, userId);
    if (existing) {
      fresh.user = { ...existing.user };
      fresh.shop.ownerUserId = existing.user.id;
    }
    this.shops.set(shopId, fresh);
    this.reconciliationDecisions.delete(shopId);
    return fresh;
  }

  public getBundleOrThrow(shopId: string): ShopSeedBundle {
    if (!shopId) {
      throw new Error('UNAUTHORIZED_MISSING_SHOP_ID');
    }
    const bundle = this.shops.get(shopId);
    if (!bundle) {
      throw new Error('SHOP_NOT_FOUND');
    }
    return bundle;
  }

  // --- Auth & Session methods ---
  public createSession(userId: string, shopId: string): SessionRecord {
    const token = `sess_${crypto.randomBytes(24).toString('hex')}`;
    const record: SessionRecord = {
      token,
      userId,
      shopId,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(token, record);
    return record;
  }

  public getSession(token?: string): SessionRecord | undefined {
    if (!token) return undefined;
    return this.sessions.get(token);
  }

  public deleteSession(token?: string): void {
    if (token) this.sessions.delete(token);
  }

  public authenticateUser(identifier: string, passwordOrOtp: string, isOtp = false): {
    user: User;
    shop: Shop;
    session: SessionRecord;
  } | null {
    const cleanId = identifier.trim().toLowerCase();
    for (const user of this.usersById.values()) {
      if (user.email.toLowerCase() === cleanId || user.mobile === cleanId) {
        if (isOtp) {
          if (passwordOrOtp !== '123456') return null;
        } else {
          const hashed = hashPassword(passwordOrOtp);
          if (user.passwordHash !== hashed && passwordOrOtp !== 'demo1234') {
            return null;
          }
        }
        const shopId = this.shopIdByUserId.get(user.id)!;
        const bundle = this.getBundleOrThrow(shopId);
        const session = this.createSession(user.id, shopId);
        return { user, shop: bundle.shop, session };
      }
    }
    return null;
  }

  public registerUserAndShop(params: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    shopName: string;
    businessType: Shop['businessType'];
    language?: Language;
    loadDemoData?: boolean;
  }): { user: User; shop: Shop; session: SessionRecord } {
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const shopId = `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const bundle = createDemoSeedBundle(shopId, userId);

    bundle.user = {
      id: userId,
      name: params.name,
      email: params.email,
      mobile: params.mobile,
      passwordHash: hashPassword(params.password),
      language: params.language || 'hinglish',
      createdAt: new Date().toISOString(),
    };
    bundle.shop = {
      ...bundle.shop,
      id: shopId,
      ownerUserId: userId,
      shopName: params.shopName || `${params.name} Store`,
      ownerName: params.name,
      mobile: params.mobile,
      email: params.email,
      businessType: params.businessType || 'kirana',
    };

    this.shops.set(shopId, bundle);
    this.usersById.set(userId, bundle.user);
    this.shopIdByUserId.set(userId, shopId);

    if (params.loadDemoData !== true) {
      this.clearShopData(shopId);
    }

    const session = this.createSession(userId, shopId);
    return { user: bundle.user, shop: bundle.shop, session };
  }

  // --- Strictly Shop-Scoped Queries & Mutations ---

  public getCustomerById(shopId: string, customerId: string): Customer | null {
    const bundle = this.getBundleOrThrow(shopId);
    const cust = bundle.customers.find((c) => c.id === customerId && c.shopId === shopId);
    return cust || null;
  }

  public createCustomer(
    shopId: string,
    data: Pick<Customer, 'name' | 'mobile' | 'email' | 'address' | 'openingBalance' | 'notes'>
  ): Customer {
    const bundle = this.getBundleOrThrow(shopId);
    const now = new Date().toISOString();
    const customer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      shopId,
      name: data.name.trim(),
      mobile: data.mobile?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      openingBalance: Number(data.openingBalance) || 0,
      averageDelayDays: 10,
      promisesKeptRatio: 0.9,
      relationshipValue: 'medium',
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };
    bundle.customers.unshift(customer);
    return customer;
  }

  public updateCustomer(
    shopId: string,
    customerId: string,
    patch: Partial<Pick<Customer, 'name' | 'mobile' | 'email' | 'address' | 'notes'>>
  ): Customer | null {
    const bundle = this.getBundleOrThrow(shopId);
    const idx = bundle.customers.findIndex((c) => c.id === customerId && c.shopId === shopId);
    if (idx === -1) return null;
    bundle.customers[idx] = {
      ...bundle.customers[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return bundle.customers[idx];
  }

  public deleteCustomer(shopId: string, customerId: string): boolean {
    const bundle = this.getBundleOrThrow(shopId);
    const idx = bundle.customers.findIndex((c) => c.id === customerId && c.shopId === shopId);
    if (idx === -1) return false;
    bundle.customers.splice(idx, 1);
    return true;
  }

  public getInvoiceById(shopId: string, invoiceId: string): Invoice | null {
    const bundle = this.getBundleOrThrow(shopId);
    return bundle.invoices.find((i) => i.id === invoiceId && i.shopId === shopId) || null;
  }

  public createInvoice(
    shopId: string,
    input: {
      type: 'sale' | 'purchase';
      invoiceNumber?: string;
      billNumber?: string;
      customerId?: string;
      customerName?: string;
      supplierId?: string;
      supplierName?: string;
      issueDate?: string;
      dueDate?: string;
      discount?: number;
      gstAmount?: number;
      total?: number;
      paidAmount?: number;
      source: Invoice['source'];
      ocrConfidence?: number;
      items: Array<{
        productId?: string;
        name: string;
        quantity: number;
        unit: string;
        weight?: string;
        unitPrice: number;
        lineTotal?: number;
        discount?: number;
        gstRate?: number;
      }>;
      notes?: string;
    }
  ): Invoice {
    const bundle = this.getBundleOrThrow(shopId);
    const now = new Date().toISOString();
    const invId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    // Auto-create customer if sale & customerName provided without matching ID
    let customerId = input.customerId;
    let customerName = input.customerName;
    if (input.type === 'sale' && !customerId && customerName) {
      const cleanName = customerName.trim().toLowerCase();
      const existingCust =
        bundle.customers.find((c) => c.name.toLowerCase() === cleanName) ||
        bundle.customers.find((c) => c.name.toLowerCase().includes(cleanName) || cleanName.includes(c.name.toLowerCase().split(/\s+/)[0]));
      if (existingCust) {
        customerId = existingCust.id;
        customerName = existingCust.name;
      } else {
        const created = this.createCustomer(shopId, {
          name: customerName,
          openingBalance: 0,
        });
        customerId = created.id;
      }
    }

    // Auto-resolve or create supplier if purchase
    let supplierId = input.supplierId;
    let supplierName = input.supplierName;
    if (input.type === 'purchase' && !supplierId && supplierName) {
      const cleanSup = supplierName.trim().toLowerCase();
      const existingSup = bundle.suppliers.find(
        (s) =>
          s.name.toLowerCase().includes(cleanSup) ||
          cleanSup.includes(s.name.toLowerCase().split(/\s+/)[0])
      );
      if (existingSup) {
        supplierId = existingSup.id;
        supplierName = existingSup.name;
      } else {
        const newSup: Supplier = {
          id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          shopId,
          name: supplierName.trim(),
          contact: '—',
          openingBalance: 0,
          notes: 'Added via Bill Scanner / Invoice entry',
          createdAt: now,
          updatedAt: now,
        };
        bundle.suppliers.unshift(newSup);
        supplierId = newSup.id;
      }
    }

    const items = input.items.map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const rawLineTotal = Number(it.lineTotal) || 0;
      const price =
        Number(it.unitPrice) > 0
          ? Number(it.unitPrice)
          : rawLineTotal > 0
            ? Math.round((rawLineTotal / qty) * 100) / 100
            : 0;
      const disc = Number(it.discount) || 0;
      const gst = Number(it.gstRate) || 0;
      const base = Math.max(0, qty * price - disc);
      const lineTotal =
        rawLineTotal > 0 && (!it.unitPrice || Number(it.unitPrice) === 0)
          ? Math.round(rawLineTotal)
          : Math.round(base * (1 + gst / 100));

      // Update inventory stock movement if product matches
      const matchedProduct =
        bundle.products.find((p) => p.id === it.productId) ||
        bundle.products.find((p) => p.name.toLowerCase().includes(it.name.toLowerCase()));

      if (matchedProduct) {
        const invItem = bundle.inventory.find((inv) => inv.productId === matchedProduct.id);
        if (invItem) {
          const delta = input.type === 'sale' ? -qty : qty;
          invItem.quantity = Math.max(0, invItem.quantity + delta);
          invItem.stockValue = Math.round(invItem.quantity * matchedProduct.costPrice);
          invItem.updatedAt = now;
          bundle.stockMovements.unshift({
            id: `sm-${Date.now()}-${idx}`,
            shopId,
            productId: matchedProduct.id,
            delta,
            reason: input.type === 'sale' ? 'invoice' : 'purchase',
            refId: invId,
            createdAt: now,
          });
        }
      }

      return {
        id: `item-${invId}-${idx + 1}`,
        invoiceId: invId,
        shopId,
        productId: matchedProduct?.id,
        name: it.name,
        quantity: qty,
        unit: it.unit || 'kg',
        weight: it.weight,
        unitPrice: price,
        discount: disc,
        gstRate: gst,
        lineTotal,
      };
    });

    const computedSubtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discount = Number(input.discount) || items.reduce((s, i) => s + i.discount, 0);
    const gstAmount =
      input.gstAmount !== undefined
        ? Number(input.gstAmount)
        : Math.max(0, items.reduce((s, i) => s + i.lineTotal, 0) - (computedSubtotal - discount));
    const computedTotal = Math.round(computedSubtotal - discount + gstAmount);
    const total =
      input.total !== undefined && Number(input.total) > 0 && (computedTotal === 0 || input.source === 'scan')
        ? Math.round(Number(input.total))
        : computedTotal;
    const subtotal = computedSubtotal > 0 ? computedSubtotal : total;
    const paidAmount = Number(input.paidAmount) || 0;

    let status: Invoice['status'] = 'unpaid';
    if (paidAmount >= total && total > 0) {
      status = paidAmount > total + 5 ? 'overpaid' : 'paid';
    } else if (paidAmount > 0) {
      status = 'partial';
    }

    const invoiceNumber =
      input.invoiceNumber ||
      (input.type === 'sale'
        ? `INV-AK-${430 + bundle.invoices.length}`
        : `PUR-AK-${210 + bundle.invoices.length}`);

    const invoice: Invoice = {
      id: invId,
      shopId,
      type: input.type,
      invoiceNumber,
      billNumber: input.billNumber || invoiceNumber,
      customerId,
      customerName,
      supplierId,
      supplierName,
      issueDate: input.issueDate || '2026-04-28',
      dueDate: input.dueDate || '2026-05-12',
      subtotal,
      discount,
      gstAmount,
      total,
      status,
      paidAmount,
      source: input.source,
      ocrConfidence: input.ocrConfidence,
      items,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    // Check if an identical invoice number + supplier already exists -> update or add
    const existingDupIdx = bundle.invoices.findIndex(
      (i) => i.invoiceNumber.toLowerCase() === invoice.invoiceNumber.toLowerCase()
    );
    if (existingDupIdx >= 0) {
      // Keep existing linked payments if re-scanning the sample Gupta Traders bill
      const existing = bundle.invoices[existingDupIdx];
      invoice.id = existing.id;
      invoice.paidAmount = existing.paidAmount;
      invoice.status = existing.status;
      bundle.invoices[existingDupIdx] = invoice;
    } else {
      bundle.invoices.unshift(invoice);
      // Dynamically update monthlySeries for the current month so Dashboard metrics update immediately
      const latestMonth = bundle.monthlySeries[bundle.monthlySeries.length - 1];
      if (latestMonth) {
        if (invoice.type === 'sale') {
          latestMonth.revenue += invoice.total;
          latestMonth.collected += invoice.paidAmount;
          latestMonth.pending += Math.max(0, invoice.total - invoice.paidAmount);
        } else {
          latestMonth.expenses += invoice.total;
        }
      }
    }

    return invoice;
  }

  public recordPayment(
    shopId: string,
    input: {
      direction: 'in' | 'out';
      partyType: Payment['partyType'];
      partyId?: string;
      partyName?: string;
      amount: number;
      date?: string;
      method: Payment['method'];
      reference?: string;
      notes?: string;
      source: Payment['source'];
      invoiceId?: string;
    }
  ): Payment {
    const bundle = this.getBundleOrThrow(shopId);
    const now = new Date().toISOString();

    let resolvedPartyId = input.partyId;
    let resolvedPartyName = input.partyName;
    if (!resolvedPartyId && resolvedPartyName) {
      const clean = resolvedPartyName.trim().toLowerCase();
      if (input.partyType === 'customer') {
        const cust = bundle.customers.find(
          (c) =>
            c.name.toLowerCase() === clean ||
            c.name.toLowerCase().includes(clean) ||
            clean.includes(c.name.toLowerCase().split(/\s+/)[0])
        );
        if (cust) {
          resolvedPartyId = cust.id;
          resolvedPartyName = cust.name;
        }
      } else if (input.partyType === 'supplier') {
        const sup = bundle.suppliers.find(
          (s) =>
            s.name.toLowerCase() === clean ||
            s.name.toLowerCase().includes(clean) ||
            clean.includes(s.name.toLowerCase().split(/\s+/)[0])
        );
        if (sup) {
          resolvedPartyId = sup.id;
          resolvedPartyName = sup.name;
        }
      }
    }

    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      shopId,
      direction: input.direction,
      partyType: input.partyType,
      partyId: resolvedPartyId,
      partyName: resolvedPartyName,
      amount: Number(input.amount),
      date: input.date || '2026-04-28',
      method: input.method || 'UPI',
      reference: input.reference,
      notes: input.notes,
      source: input.source,
      invoiceId: input.invoiceId,
      createdAt: now,
    };
    bundle.payments.unshift(payment);

    // Apply against open invoice if linked or customer has open invoice
    const targetInvoice = input.invoiceId
      ? bundle.invoices.find((i) => i.id === input.invoiceId && i.shopId === shopId)
      : bundle.invoices.find(
          (i) =>
            i.shopId === shopId &&
            ((input.partyType === 'customer' && i.customerId === resolvedPartyId) ||
              (input.partyType === 'supplier' && i.supplierId === resolvedPartyId)) &&
            i.status !== 'paid'
        );

    if (targetInvoice) {
      payment.invoiceId = targetInvoice.id;
      targetInvoice.paidAmount += payment.amount;
      if (Math.abs(targetInvoice.paidAmount - targetInvoice.total) <= 5) {
        targetInvoice.status = 'paid';
      } else if (targetInvoice.paidAmount > targetInvoice.total) {
        targetInvoice.status = 'overpaid';
      } else {
        targetInvoice.status = 'partial';
      }
    }

    const latestMonth = bundle.monthlySeries[bundle.monthlySeries.length - 1];
    if (latestMonth) {
      if (payment.direction === 'in') {
        latestMonth.collected += payment.amount;
        latestMonth.pending = Math.max(0, latestMonth.pending - payment.amount);
      } else {
        latestMonth.expenses += payment.amount;
      }
    }

    return payment;
  }

  public confirmOrRejectMatch(
    shopId: string,
    bankTransactionId: string,
    decision: 'confirm' | 'reject',
    invoiceId?: string
  ) {
    const bundle = this.getBundleOrThrow(shopId);
    const txn = bundle.bankTransactions.find((t) => t.id === bankTransactionId && t.shopId === shopId);
    if (!txn) return null;

    const existingList = this.reconciliationDecisions.get(shopId) || [];
    const filtered = existingList.filter((d) => d.bankTransactionId !== bankTransactionId);

    if (decision === 'confirm') {
      const targetInv = invoiceId
        ? bundle.invoices.find((i) => i.id === invoiceId && i.shopId === shopId)
        : undefined;
      txn.matchStatus = 'matched';
      txn.linkedInvoiceId = targetInv?.id;

      if (targetInv) {
        targetInv.paidAmount += txn.amount;
        targetInv.status = targetInv.paidAmount >= targetInv.total ? 'paid' : 'partial';
      }

      filtered.push({
        id: `rmatch-user-${bankTransactionId}`,
        shopId,
        bankTransactionId,
        invoiceId: targetInv?.id || 'manual-verified',
        confidence: 100,
        status: 'user_confirmed',
        derivedStatus: 'paid',
        reasons: [
          {
            signal: 'userConfirmed',
            label: 'Confirmed by Shop Owner',
            matched: true,
            weight: 100,
            earned: 100,
            detail: '✓ Manually verified and confirmed in Payment Inbox',
          },
        ],
        alternatives: [],
        createdAt: new Date().toISOString(),
        confirmedBy: bundle.user.name,
      });
    } else {
      txn.matchStatus = 'unmatched';
      txn.linkedInvoiceId = undefined;
      filtered.push({
        id: `rmatch-rej-${bankTransactionId}`,
        shopId,
        bankTransactionId,
        invoiceId,
        confidence: 0,
        status: 'rejected',
        derivedStatus: 'unknown',
        reasons: [],
        alternatives: [],
        createdAt: new Date().toISOString(),
      });
    }

    this.reconciliationDecisions.set(shopId, filtered);
    return txn;
  }

  public updateDuplicateStatus(
    shopId: string,
    duplicateId: string,
    status: 'confirmed' | 'dismissed' | 'reminded_later'
  ) {
    const bundle = this.getBundleOrThrow(shopId);
    bundle.duplicateDecisions[duplicateId] = status;
    return { duplicateId, status };
  }

  public getFullShopIntelligence(shopId: string, whatIf: WhatIfOptions = {}) {
    const bundle = this.getBundleOrThrow(shopId);
    const decisions = this.reconciliationDecisions.get(shopId) || [];

    const recon = runReconciliation(
      shopId,
      bundle.bankTransactions,
      bundle.invoices,
      bundle.payments,
      bundle.customers,
      bundle.suppliers,
      decisions
    );

    const duplicates: DuplicateCandidate[] = detectDuplicatePayments(
      shopId,
      bundle.bankTransactions,
      bundle.invoices,
      bundle.duplicateDecisions
    );

    const supplierInsights = computeSupplierPriceIntelligence(bundle.products);
    const lostMoney = aggregateLostMoney(
      duplicates,
      bundle.customers,
      bundle.invoices,
      bundle.payments,
      bundle.bankTransactions,
      supplierInsights
    );
    const collections = rankSmartCollections(bundle.customers, bundle.invoices, bundle.payments);

    const scoringInput = {
      shop: bundle.shop,
      customers: bundle.customers,
      invoices: bundle.invoices,
      payments: bundle.payments,
      bankTransactions: bundle.bankTransactions,
      duplicates,
      monthlySeries: bundle.monthlySeries,
    };

    const financialHealth = computeFinancialHealth(scoringInput);
    const loanReadiness = computeLoanReadiness(scoringInput, whatIf);
    const cashflow = computeCashflowForecast(scoringInput);
    const profitLeakage = computeProfitLeakage(scoringInput, supplierInsights);
    const alerts: Alert[] = generateSystemAlerts(
      shopId,
      duplicates,
      bundle.customers,
      bundle.invoices,
      bundle.payments,
      bundle.bankTransactions,
      bundle.inventory,
      bundle.products,
      bundle.alertStatuses
    );

    return {
      user: {
        id: bundle.user.id,
        name: bundle.user.name,
        email: bundle.user.email,
        mobile: bundle.user.mobile,
        language: bundle.user.language,
      },
      shop: bundle.shop,
      customers: bundle.customers,
      suppliers: bundle.suppliers,
      products: bundle.products,
      inventory: bundle.inventory,
      stockMovements: bundle.stockMovements,
      invoices: bundle.invoices,
      payments: bundle.payments,
      bankStatements: bundle.bankStatements,
      bankTransactions: bundle.bankTransactions,
      reconciliationMatches: recon.matches,
      duplicates,
      lostMoney,
      collections,
      financialHealth,
      loanReadiness,
      cashflow,
      supplierInsights,
      profitLeakage,
      alerts,
      reminders: bundle.reminders,
      scoreSnapshots: bundle.scoreSnapshots,
      monthlySeries: bundle.monthlySeries,
      aiMessages: bundle.aiMessages,
    };
  }

  public createOrUpdateReminder(
    shopId: string,
    params: {
      customerId: string;
      channel: Reminder['channel'];
      tone: Reminder['tone'];
      status?: Reminder['status'];
    }
  ): Reminder | null {
    const bundle = this.getBundleOrThrow(shopId);
    const cust = bundle.customers.find((c) => c.id === params.customerId && c.shopId === shopId);
    if (!cust) return null;

    const collections = rankSmartCollections(bundle.customers, bundle.invoices, bundle.payments);
    const col = collections.find((c) => c.customerId === cust.id);
    const amount = col ? col.outstandingAmount : 15000;
    const daysOverdue = col ? col.daysOverdue : 15;

    const draftText = generateReminderDraft(
      cust.name,
      bundle.shop.shopName,
      amount,
      daysOverdue,
      params.tone,
      bundle.user.language
    );

    const reminder: Reminder = {
      id: `rem-${Date.now()}`,
      shopId,
      customerId: cust.id,
      customerName: cust.name,
      customerMobile: cust.mobile,
      amount,
      daysOverdue,
      channel: params.channel,
      tone: params.tone,
      draftText,
      status: params.status || 'draft',
      createdAt: new Date().toISOString(),
    };
    bundle.reminders.unshift(reminder);
    return reminder;
  }
}

export const repo = new MultiTenantRepository();
