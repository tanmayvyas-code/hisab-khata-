import type {
  BankTransaction,
  CollectFirstItem,
  Customer,
  DuplicateCandidate,
  Invoice,
  Language,
  LostMoneyItem,
  LostMoneySummary,
  Payment,
  SupplierPriceInsight,
} from '../types/domain.ts';

const SERIOUS_OVERDUE_DAYS_THRESHOLD = 40;

export function calculateCustomerOutstanding(
  customer: Customer,
  invoices: Invoice[],
  payments: Payment[],
  referenceDate = '2026-04-28'
): {
  outstandingAmount: number;
  oldestOverdueDays: number;
  openInvoices: Invoice[];
} {
  const custInvoices = invoices.filter((inv) => inv.type === 'sale' && inv.customerId === customer.id);
  const custUnlinkedPayments = payments.filter(
    (p) => p.direction === 'in' && p.partyType === 'customer' && p.partyId === customer.id && !p.invoiceId
  );

  let unpaidInvoiceSum = 0;
  let maxDaysOverdue = 0;
  const openInvoices: Invoice[] = [];
  const refTime = new Date(referenceDate).getTime();

  for (const inv of custInvoices) {
    const remaining = Math.max(0, inv.total - inv.paidAmount);
    if (remaining > 5) {
      unpaidInvoiceSum += remaining;
      openInvoices.push(inv);
      const dueTime = new Date(inv.dueDate || inv.issueDate).getTime();
      const days = Math.max(0, Math.round((refTime - dueTime) / (1000 * 60 * 60 * 24)));
      if (days > maxDaysOverdue) {
        maxDaysOverdue = days;
      }
    }
  }

  const unlinkedSum = custUnlinkedPayments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = Math.max(0, customer.openingBalance + unpaidInvoiceSum - unlinkedSum);

  return {
    outstandingAmount: totalOutstanding,
    oldestOverdueDays: maxDaysOverdue,
    openInvoices,
  };
}

export function rankSmartCollections(
  customers: Customer[],
  invoices: Invoice[],
  payments: Payment[],
  referenceDate = '2026-04-28'
): CollectFirstItem[] {
  const ranked: CollectFirstItem[] = [];

  for (const cust of customers) {
    const { outstandingAmount, oldestOverdueDays, openInvoices } = calculateCustomerOutstanding(
      cust,
      invoices,
      payments,
      referenceDate
    );
    if (outstandingAmount <= 0) continue;

    // Priority score combining amount, days overdue, payment history, and relationship value
    const amountFactor = Math.min(45, (outstandingAmount / 50000) * 45);
    const overdueFactor = Math.min(35, (oldestOverdueDays / 45) * 35);
    const delayPenalty = Math.min(10, (cust.averageDelayDays / 30) * 10);
    const relationshipWeight = cust.relationshipValue === 'high' ? 10 : cust.relationshipValue === 'medium' ? 6 : 4;

    const priorityScore = Math.min(
      99,
      Math.round(amountFactor + overdueFactor + delayPenalty + relationshipWeight)
    );

    const tier: 'critical_recovery' | 'follow_up' =
      oldestOverdueDays >= SERIOUS_OVERDUE_DAYS_THRESHOLD ? 'critical_recovery' : 'follow_up';

    const reason =
      oldestOverdueDays >= SERIOUS_OVERDUE_DAYS_THRESHOLD
        ? `₹${outstandingAmount.toLocaleString('en-IN')} pending for ${oldestOverdueDays} days (Avg delay: ${cust.averageDelayDays}d)`
        : `₹${outstandingAmount.toLocaleString('en-IN')} overdue by ${oldestOverdueDays} days — regular follow-up recommended`;

    ranked.push({
      rank: 0,
      customerId: cust.id,
      customerName: cust.name,
      mobile: cust.mobile,
      outstandingAmount,
      daysOverdue: oldestOverdueDays,
      priorityScore,
      tier,
      reason,
      averageDelayDays: cust.averageDelayDays,
      promisesKeptRatio: cust.promisesKeptRatio,
      invoiceIds: openInvoices.map((i) => i.id),
    });
  }

  ranked.sort((a, b) => b.priorityScore - a.priorityScore || b.outstandingAmount - a.outstandingAmount);
  ranked.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return ranked;
}

export function generateReminderDraft(
  customerName: string,
  shopName: string,
  amount: number,
  daysOverdue: number,
  tone: 'polite' | 'firm' | 'final',
  language: Language = 'hinglish'
): string {
  const amtStr = `₹${amount.toLocaleString('en-IN')}`;
  if (language === 'en') {
    if (tone === 'polite') {
      return `Hello ${customerName} ji, friendly reminder from ${shopName}. Your balance of ${amtStr} has been pending for ${daysOverdue} days. Please share the payment via UPI or bank transfer at your earliest convenience. Thank you!`;
    }
    if (tone === 'firm') {
      return `Dear ${customerName} ji, your pending payment of ${amtStr} at ${shopName} is now ${daysOverdue} days overdue. Please clear this balance within 48 hours so we can keep your credit account active. Thank you.`;
    }
    return `URGENT: ${customerName} ji, your overdue balance of ${amtStr} (${daysOverdue} days past due) at ${shopName} requires immediate settlement today before our monthly closing.`;
  }

  if (language === 'hi') {
    if (tone === 'polite') {
      return `नमस्ते ${customerName} जी, ${shopName} की ओर से विनम्र निवेदन। आपका ${amtStr} का हिसाब ${daysOverdue} दिनों से बाकी है। कृपया सुविधा अनुसार UPI या बैंक से पेमेंट कर दें। धन्यवाद!`;
    }
    if (tone === 'firm') {
      return `नमस्ते ${customerName} जी, ${shopName} में आपका ${amtStr} का बकाया ${daysOverdue} दिन पुराना हो चुका है। कृपया अगले 2 दिनों में हिसाब क्लियर कर दें ताकि आगे का लेन-देन सुचारू रहे।`;
    }
    return `अंतिम रिमाइंडर: ${customerName} जी, आपका ${amtStr} (${daysOverdue} दिन बकाया) आज ही जमा कराने की कृपा करें, महीने की क्लोजिंग हो रही है। — ${shopName}`;
  }

  // Default Hinglish
  if (tone === 'polite') {
    return `Namaste ${customerName} ji, ${shopName} se yaad dila rahe hain ki aapka ${amtStr} ka payment ${daysOverdue} din se pending hai. Jab suvidha ho UPI ya bank transfer se bhej dijiye. Dhanyavaad!`;
  }
  if (tone === 'firm') {
    return `Namaste ${customerName} ji, ${shopName} par aapka ${amtStr} ka balance ${daysOverdue} din se overdue hai. Hamari monthly closing chal rahi hai, kripya 2 din ke andar payment clear kar dein.`;
  }
  return `Important: ${customerName} ji, aapka ${amtStr} ka payment ${daysOverdue} din se baaki hai. Kripya aaj hi ${shopName} ka hisaab settle karein taaki aapki udhaar limit chalu rahe.`;
}

export function aggregateLostMoney(
  duplicates: DuplicateCandidate[],
  customers: Customer[],
  invoices: Invoice[],
  payments: Payment[],
  bankTransactions: BankTransaction[],
  supplierInsights: SupplierPriceInsight[],
  referenceDate = '2026-04-28'
): LostMoneySummary {
  const items: LostMoneyItem[] = [];

  // 1. Duplicate payments (Hero High-Priority Bucket)
  let duplicatePaymentsTotal = 0;
  for (const dup of duplicates) {
    duplicatePaymentsTotal += dup.recoverableAmount;
    items.push({
      id: `lm-dup-${dup.id}`,
      category: 'duplicate_payment',
      bucket: 'hero_high_priority',
      outcomePillar: 'SAVE',
      title: `Possible duplicate payment to ${dup.counterpartyName}`,
      partyName: dup.counterpartyName,
      entityId: dup.id,
      amount: dup.recoverableAmount,
      confidence: dup.confidence,
      isConfirmed: dup.status === 'confirmed',
      evidence: dup.evidence,
      recommendedAction: 'Confirm duplicate & send refund/credit-note message to vendor',
      actionRoute: '/reconciliation',
      actionType: 'confirm_duplicate',
    });
  }

  // 2. Overpayments on invoices (Hero High-Priority Bucket)
  let overpaymentTotal = 0;
  for (const inv of invoices) {
    if (inv.status === 'overpaid' && inv.paidAmount > inv.total) {
      const excess = inv.paidAmount - inv.total;
      overpaymentTotal += excess;
      const partyName = inv.supplierName || inv.customerName || 'Supplier';
      items.push({
        id: `lm-over-${inv.id}`,
        category: 'overpayment',
        bucket: 'hero_high_priority',
        outcomePillar: 'SAVE',
        title: `Excess payment on ${inv.billNumber || inv.invoiceNumber}`,
        partyName,
        partyId: inv.supplierId || inv.customerId,
        entityId: inv.id,
        amount: excess,
        confidence: 92,
        isConfirmed: true,
        evidence: [
          `Invoice ${inv.billNumber || inv.invoiceNumber} total is ₹${inv.total.toLocaleString('en-IN')}`,
          `Total paid against this bill is ₹${inv.paidAmount.toLocaleString('en-IN')}`,
          `Excess ₹${excess.toLocaleString('en-IN')} recoverable via credit note or next purchase adjustment`,
        ],
        recommendedAction: `Ask ${partyName} for ₹${excess.toLocaleString('en-IN')} credit note adjustment`,
        actionRoute: '/reconciliation',
        actionType: 'request_credit_note',
      });
    }
  }

  // 3. Pending Collections (Split into Hero Seriously Overdue >=40d vs Follow-Up <40d)
  const collections = rankSmartCollections(customers, invoices, payments, referenceDate);
  let overdueCollectionsHeroTotal = 0;
  let followUpReceivablesTotal = 0;

  for (const col of collections) {
    const isHero = col.daysOverdue >= SERIOUS_OVERDUE_DAYS_THRESHOLD;
    if (isHero) {
      overdueCollectionsHeroTotal += col.outstandingAmount;
    } else {
      followUpReceivablesTotal += col.outstandingAmount;
    }

    items.push({
      id: `lm-col-${col.customerId}`,
      category: 'pending_collection',
      bucket: isHero ? 'hero_high_priority' : 'follow_up',
      outcomePillar: 'GET',
      title: isHero
        ? `Seriously overdue receivable (${col.daysOverdue} days)`
        : `Overdue follow-up (${col.daysOverdue} days)`,
      partyName: col.customerName,
      partyId: col.customerId,
      entityId: col.customerId,
      amount: col.outstandingAmount,
      confidence: 96,
      isConfirmed: true,
      daysOverdue: col.daysOverdue,
      evidence: [
        `Aapko ${col.customerName} se ₹${col.outstandingAmount.toLocaleString('en-IN')} lena hai`,
        `Payment ${col.daysOverdue} din se overdue hai (Average delay: ${col.averageDelayDays} din)`,
      ],
      recommendedAction: `Send smart WhatsApp/SMS reminder to ${col.customerName}`,
      actionRoute: `/customers/${col.customerId}`,
      actionType: 'send_reminder',
    });
  }

  // 4. Unmatched / Possible payments waiting in Payment Inbox
  let unmatchedPaymentsTotal = 0;
  const inboxTxns = bankTransactions.filter(
    (t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  );
  for (const txn of inboxTxns) {
    unmatchedPaymentsTotal += txn.amount;
    items.push({
      id: `lm-unm-${txn.id}`,
      category: 'unmatched_payment',
      bucket: 'follow_up',
      outcomePillar: 'READY',
      title:
        txn.matchStatus === 'possible'
          ? `Possible match waiting for confirmation`
          : `Ye payment kisi bill se match nahi ho rahi`,
      partyName: txn.counterpartyName || txn.description.slice(0, 28),
      entityId: txn.id,
      amount: txn.amount,
      confidence: txn.matchStatus === 'possible' ? 74 : 35,
      isConfirmed: false,
      evidence: [
        `Bank narration: "${txn.description}" on ${txn.date}`,
        `Unreconciled entries reduce your Loan Readiness score`,
      ],
      recommendedAction: 'Review & confirm in Payment Inbox',
      actionRoute: '/payments/inbox',
      actionType: 'review_inbox',
    });
  }

  // 5. Supplier price gap savings
  let supplierMonthlySavingsEst = 0;
  for (const sp of supplierInsights) {
    supplierMonthlySavingsEst += sp.estimatedMonthlySaving;
    items.push({
      id: `lm-sup-${sp.productId}`,
      category: 'supplier_price_gap',
      bucket: 'follow_up',
      outcomePillar: 'SAVE',
      title: `Paying ₹${sp.priceGapPerUnit}/${sp.unit} extra on ${sp.productName}`,
      partyName: sp.currentSupplierName,
      entityId: sp.productId,
      amount: sp.estimatedMonthlySaving,
      confidence: 90,
      isConfirmed: true,
      evidence: [
        `${sp.currentSupplierName} charges ₹${sp.currentPrice}/${sp.unit} vs ${sp.cheapestSupplierName} at ₹${sp.cheapestPrice}/${sp.unit}`,
        `Estimated saving of ₹${sp.estimatedMonthlySaving.toLocaleString('en-IN')}/month on ${sp.monthlyVolume} ${sp.unit}`,
      ],
      recommendedAction: `Negotiate rate or shift order to ${sp.cheapestSupplierName}`,
      actionRoute: '/suppliers',
      actionType: 'switch_supplier',
    });
  }

  const heroRecoveryTotal = duplicatePaymentsTotal + overdueCollectionsHeroTotal + overpaymentTotal;

  return {
    heroRecoveryTotal,
    duplicatePaymentsTotal,
    overdueCollectionsHeroTotal,
    overpaymentTotal,
    followUpReceivablesTotal,
    unmatchedPaymentsTotal,
    supplierMonthlySavingsEst,
    items,
  };
}
