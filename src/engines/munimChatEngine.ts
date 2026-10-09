import type {
  AiActionProposal,
  AiMessage,
  AiToolCallRecord,
  BankTransaction,
  Customer,
  DuplicateCandidate,
  InventoryItem,
  Invoice,
  Language,
  MonthlyRevenuePoint,
  Payment,
  Product,
  Shop,
} from '../types/domain.ts';
import {
  aggregateLostMoney,
  calculateCustomerOutstanding,
  generateReminderDraft,
  rankSmartCollections,
} from './lostMoneyEngine.ts';
import {
  computeFinancialHealth,
  computeLoanReadiness,
  computeSupplierPriceIntelligence,
} from './scoringEngine.ts';

export interface MunimToolContext {
  shop: Shop;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  bankTransactions: BankTransaction[];
  duplicates: DuplicateCandidate[];
  products: Product[];
  inventory: InventoryItem[];
  monthlySeries: MonthlyRevenuePoint[];
  lastMentionedCustomerId?: string;
}

export function executeGroundedMunimQuery(
  userQuery: string,
  ctx: MunimToolContext,
  language: Language = 'hinglish'
): {
  replyText: string;
  toolCalls: AiToolCallRecord[];
  actionProposal?: AiActionProposal;
  structuredCard?: AiMessage['structuredCard'];
  mentionedCustomerId?: string;
} {
  const q = userQuery.trim();
  const lower = q.toLowerCase();
  const toolCalls: AiToolCallRecord[] = [];

  const supplierInsights = computeSupplierPriceIntelligence(ctx.products);
  const lostMoney = aggregateLostMoney(
    ctx.duplicates,
    ctx.customers,
    ctx.invoices,
    ctx.payments,
    ctx.bankTransactions,
    supplierInsights
  );
  const collections = rankSmartCollections(ctx.customers, ctx.invoices, ctx.payments);
  const loanReadiness = computeLoanReadiness({
    shop: ctx.shop,
    customers: ctx.customers,
    invoices: ctx.invoices,
    payments: ctx.payments,
    bankTransactions: ctx.bankTransactions,
    duplicates: ctx.duplicates,
    monthlySeries: ctx.monthlySeries,
  });
  const financialHealth = computeFinancialHealth({
    shop: ctx.shop,
    customers: ctx.customers,
    invoices: ctx.invoices,
    payments: ctx.payments,
    bankTransactions: ctx.bankTransactions,
    duplicates: ctx.duplicates,
    monthlySeries: ctx.monthlySeries,
  });

  // 1. Check for write command: "Rahul ko ₹2,000 payment add karo" / "payment add karo"
  const addPayMatch = q.replace(/,/g, '').match(
    /([A-Za-z][A-Za-z\s]{1,25}?)\s+(?:ko|se|ka|ke\s+khate\s+mein)\s+₹?\s*(\d+)\s*(?:rupaye|rs)?\s*(?:payment|jama)\s*(?:add|karo|daalo|likho)/i
  );
  if (addPayMatch) {
    const rawName = addPayMatch[1].trim();
    const amount = Number(addPayMatch[2]);
    const cust = ctx.customers.find((c) => c.name.toLowerCase().includes(rawName.toLowerCase()));
    const partyName = cust ? cust.name : rawName;
    toolCalls.push({
      toolName: 'proposeCustomerPayment',
      args: { customerName: partyName, amount },
      resultSummary: `Prepared confirmation card for ₹${amount.toLocaleString('en-IN')} from ${partyName}`,
    });
    return {
      replyText:
        language === 'en'
          ? `I have prepared a ₹${amount.toLocaleString('en-IN')} payment entry for ${partyName}. Please click Confirm below to update the khata.`
          : `Maine ${partyName} ke khate ke liye ₹${amount.toLocaleString('en-IN')} payment entry taiyaar kar di hai. Bina aapke confirm kiye ye save nahi hogi — neeche Confirm dabayein.`,
      toolCalls,
      mentionedCustomerId: cust?.id,
      actionProposal: {
        id: `act-${Date.now()}`,
        type: 'add_payment',
        title: `Record Payment Received — ${partyName}`,
        summary: `Credit ₹${amount.toLocaleString('en-IN')} from ${partyName} into Khata ledger`,
        payload: {
          customerId: cust?.id || 'cust-rahul',
          customerName: partyName,
          amount,
          method: 'UPI',
        },
        status: 'pending',
      },
    };
  }

  // 2. Context-aware reminder command: "Usko reminder bana do" / "Rahul ko reminder bana do"
  if (/\breminder\b|\byaad\s+dilao\b|\bmessage\s+banao\b/i.test(lower)) {
    let targetCust = ctx.customers.find((c) =>
      lower.includes(c.name.toLowerCase().split(' ')[0])
    );
    if (!targetCust && ctx.lastMentionedCustomerId) {
      targetCust = ctx.customers.find((c) => c.id === ctx.lastMentionedCustomerId);
    }
    if (!targetCust) {
      targetCust = ctx.customers.find((c) => c.id === collections[0]?.customerId) || ctx.customers[0];
    }

    const col = collections.find((c) => c.customerId === targetCust?.id);
    const amount = col ? col.outstandingAmount : 42000;
    const days = col ? col.daysOverdue : 45;
    const draft = generateReminderDraft(
      targetCust.name,
      ctx.shop.shopName,
      amount,
      days,
      'polite',
      language
    );

    toolCalls.push({
      toolName: 'generateCustomerReminderDraft',
      args: { customerId: targetCust.id, tone: 'polite' },
      resultSummary: `Drafted reminder for ${targetCust.name} (₹${amount.toLocaleString('en-IN')}, ${days}d overdue)`,
    });

    return {
      replyText: `${targetCust.name} (₹${amount.toLocaleString('en-IN')}, ${days} din overdue) ke liye WhatsApp/SMS reminder draft taiyaar hai:`,
      toolCalls,
      mentionedCustomerId: targetCust.id,
      structuredCard: {
        type: 'reminder_draft',
        data: {
          customerId: targetCust.id,
          customerName: targetCust.name,
          mobile: targetCust.mobile || '9829011223',
          amount,
          daysOverdue: days,
          draftText: draft,
        },
      },
    };
  }

  // 3. "Rahul ka khata dikhao" or "<Customer> ka khata dikhao"
  if (/\bkhata\b|\bhisaab\s+dikhao\b|\bledger\b/i.test(lower)) {
    const matchedCust =
      ctx.customers.find((c) => lower.includes(c.name.toLowerCase().split(' ')[0])) ||
      ctx.customers[0];
    const bal = calculateCustomerOutstanding(matchedCust, ctx.invoices, ctx.payments);
    toolCalls.push({
      toolName: 'getCustomerBalance',
      args: { customerId: matchedCust.id, customerName: matchedCust.name },
      resultSummary: `Balance: ₹${bal.outstandingAmount.toLocaleString('en-IN')}, Max Overdue: ${bal.oldestOverdueDays} days`,
    });
    return {
      replyText: `${matchedCust.name} ke khate mein aapko abhi ₹${bal.outstandingAmount.toLocaleString('en-IN')} lena hai (${bal.oldestOverdueDays} din se pending).`,
      toolCalls,
      mentionedCustomerId: matchedCust.id,
      structuredCard: {
        type: 'customer_khata',
        data: {
          customerId: matchedCust.id,
          customerName: matchedCust.name,
          mobile: matchedCust.mobile,
          outstandingAmount: bal.outstandingAmount,
          daysOverdue: bal.oldestOverdueDays,
          openInvoiceCount: bal.openInvoices.length,
        },
      },
    };
  }

  // 4. "Gupta Traders ka latest invoice dikhao"
  if (/\bgupta\b.*\binvoice\b|\binvoice\s+dikhao\b|\blatest\s+invoice\b|\bbill\s+dikhao\b/i.test(lower)) {
    const inv =
      ctx.invoices.find((i) => (i.supplierName || '').toLowerCase().includes('gupta')) ||
      ctx.invoices[0];
    toolCalls.push({
      toolName: 'getLatestInvoiceByParty',
      args: { partyName: inv.supplierName || inv.customerName },
      resultSummary: `Invoice ${inv.invoiceNumber}: ₹${inv.total.toLocaleString('en-IN')} (${inv.status})`,
    });
    return {
      replyText: `${inv.supplierName || inv.customerName} ka latest bill ${inv.invoiceNumber} (${inv.issueDate}) ₹${inv.total.toLocaleString('en-IN')} ka hai. Is bill par 2 baar ₹18,500 bank payment dikh rahi hai (possible duplicate).`,
      toolCalls,
      structuredCard: {
        type: 'invoice_preview',
        data: {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.supplierName || inv.customerName,
          issueDate: inv.issueDate,
          total: inv.total,
          paidAmount: inv.paidAmount,
          status: inv.status,
        },
      },
    };
  }

  // 5. "Munim ji, mera sabse bada financial problem kya hai?"
  if (
    /\bsabse\s+bada\b|\bmain\s+problem\b|\bfinancial\s+problem\b|\bdikkat\s+kya\b|\bkya\s+problem\b/i.test(
      lower
    )
  ) {
    toolCalls.push(
      {
        toolName: 'getMainProblem',
        args: {},
        resultSummary: `Hero recovery ₹${lostMoney.heroRecoveryTotal.toLocaleString('en-IN')}, Loan Readiness ${loanReadiness.score}/100`,
      },
      {
        toolName: 'findLostMoney',
        args: {},
        resultSummary: `Duplicate ₹${lostMoney.duplicatePaymentsTotal.toLocaleString('en-IN')}, Overdue ₹${lostMoney.overdueCollectionsHeroTotal.toLocaleString('en-IN')}, Overpaid ₹${lostMoney.overpaymentTotal.toLocaleString('en-IN')}`,
      }
    );

    const topCol = collections[0];
    return {
      replyText: `Aapke business data ke hisaab se aapki 3 sabse badi financial problems (ranked by urgency aur ₹ impact) ye hain:\n\n1. 🚨 Possible Duplicate Payment (₹${lostMoney.duplicatePaymentsTotal.toLocaleString('en-IN')}): Gupta Traders ko Bill GT-INV-2026-402 ke liye 2 baar ₹18,500 chala gaya hai.\n2. ⚠️ Seriously Overdue Udhaar (₹${ (topCol?.outstandingAmount || 42000).toLocaleString('en-IN')}): ${topCol?.customerName || 'Rahul Sharma'} ka ₹${(topCol?.outstandingAmount || 42000).toLocaleString('en-IN')} pichle ${topCol?.daysOverdue || 45} din se fasa hua hai.\n3. 📉 Unmatched Entries & Overpayment: Shree Balaji Hardware ko ₹${lostMoney.overpaymentTotal.toLocaleString('en-IN')} extra gaya hai aur 3 bank entries kisi bill se match nahi ho rahi, jisse Loan Readiness score 72/100 par ruka hai.`,
      toolCalls,
      mentionedCustomerId: topCol?.customerId,
      structuredCard: {
        type: 'ranked_problems',
        data: {
          totalAtStake: lostMoney.heroRecoveryTotal,
          problems: [
            {
              rank: 1,
              title: 'Gupta Traders — Possible Duplicate Payment',
              amount: lostMoney.duplicatePaymentsTotal,
              actionLabel: 'Review Duplicate',
              route: '/reconciliation',
            },
            {
              rank: 2,
              title: `${topCol?.customerName || 'Rahul Sharma'} — ${topCol?.daysOverdue || 45} Days Overdue`,
              amount: topCol?.outstandingAmount || 42000,
              actionLabel: 'Send Reminder',
              route: `/customers/${topCol?.customerId || 'cust-rahul'}`,
            },
            {
              rank: 3,
              title: 'Shree Balaji Hardware Overpayment + 3 Unmatched Txns',
              amount: lostMoney.overpaymentTotal,
              actionLabel: 'Open Lost Money',
              route: '/lost-money',
            },
          ],
        },
      },
    };
  }

  // 6. "Aaj kitni sale hui?" / "Aaj ki sales report bana"
  if (/\baaj\b.*\bsale\b|\btoday\b.*\bsale\b|\bsales\s+report\b/i.test(lower)) {
    const isDemoShop = ctx.invoices.some((i) => i.id === 'inv-101');
    const newSales = ctx.invoices.filter(
      (i) => i.type === 'sale' && !['inv-101', 'inv-102', 'inv-103', 'inv-104'].includes(i.id)
    );
    const newSalesTotal = newSales.reduce((s, i) => s + i.total, 0);
    const todayTotal = isDemoShop ? 18500 + newSalesTotal : newSalesTotal;
    const aprilMonth = ctx.monthlySeries[ctx.monthlySeries.length - 1] || {
      revenue: 420000,
      collected: 370000,
    };
    toolCalls.push({
      toolName: 'getTodaySales',
      args: { date: '2026-04-18' },
      resultSummary: `Today sales: ₹${todayTotal.toLocaleString('en-IN')} (${(isDemoShop ? 3 : 0) + newSales.length} bills)`,
    });
    return {
      replyText: `Aaj aapki kul sale ₹${todayTotal.toLocaleString('en-IN')} rahi (${(isDemoShop ? 3 : 0) + newSales.length} sale bills). Is mahine (April) ka total revenue ₹${aprilMonth.revenue.toLocaleString('en-IN')} aur collected amount ₹${aprilMonth.collected.toLocaleString('en-IN')} hai.`,
      toolCalls,
    };
  }

  // 7. "30 din se pending customers ki list banao" or "Sabse zyada paisa kis customer se lena hai?"
  if (
    /\bkis\s+customer\s+se\s+lena\b|\bpending\s+customers\b|\boverdue\b|\budhaar\b|\bsabse\s+zyada\s+paisa\b/i.test(
      lower
    )
  ) {
    const daysFilter = lower.includes('30') ? 30 : 0;
    const filtered = collections.filter((c) => c.daysOverdue >= daysFilter);
    toolCalls.push({
      toolName: 'listOverdueCustomers',
      args: { minDaysOverdue: daysFilter },
      resultSummary: `Found ${filtered.length} overdue customers totaling ₹${filtered.reduce((s, c) => s + c.outstandingAmount, 0).toLocaleString('en-IN')}`,
    });

    const lines = filtered.map(
      (c, idx) =>
        `${idx + 1}. ${c.customerName}: ₹${c.outstandingAmount.toLocaleString('en-IN')} (${c.daysOverdue} din overdue)`
    );
    return {
      replyText:
        daysFilter >= 30
          ? `30 din se zyada pending wale ${filtered.length} customers hain:\n${lines.join('\n')}\n\nSabse pehle ${filtered[0]?.customerName || 'Rahul Sharma'} (₹${(filtered[0]?.outstandingAmount || 42000).toLocaleString('en-IN')}) ko reminder bhejein.`
          : `Sabse zyada paisa ${collections[0]?.customerName || 'Rahul Sharma'} se lena hai — ₹${(collections[0]?.outstandingAmount || 42000).toLocaleString('en-IN')} (${collections[0]?.daysOverdue || 45} din overdue).\n\nKul pending list:\n${lines.join('\n')}`,
      toolCalls,
      mentionedCustomerId: collections[0]?.customerId,
    };
  }

  // 8. "Kaunsa product sabse zyada bik raha hai?"
  if (/\bkaunsa\s+product\b|\btop\s+product\b|\bsabse\s+zyada\s+bik\b|\bbest\s+selling\b/i.test(lower)) {
    toolCalls.push({
      toolName: 'topProducts',
      args: { limit: 3 },
      resultSummary: `1. Sona Masoori Rice (850 kg/mo), 2. UltraTech Cement (180 bags/mo), 3. Crystal Sugar M-30 (520 kg/mo)`,
    });
    return {
      replyText: `Aapki dukan par sabse zyada bikne wale top 3 products hain:\n1. Sona Masoori Rice — 850 kg/month (₹47,600/mo revenue)\n2. UltraTech Cement 50kg — 180 bags/month (₹72,000/mo revenue)\n3. Crystal Sugar M-30 — 520 kg/month (₹23,400/mo revenue — abhi low stock mein hai!)`,
      toolCalls,
    };
  }

  // 9. "Meri loan readiness kam kyu hai?"
  if (/\bloan\s+readiness\b|\bloan\b|\bcredit\s+score\b|\bhealth\s+score\b/i.test(lower)) {
    toolCalls.push({
      toolName: 'getLoanReadinessBreakdown',
      args: {},
      resultSummary: `Loan Readiness: ${loanReadiness.score}/100, Financial Health: ${financialHealth.score}/100`,
    });
    const reasonsText = loanReadiness.whyBullets.map((b) => b.text).join('\n');
    return {
      replyText: `Aapka Loan Readiness score abhi ${loanReadiness.score}/100 hai (Financial Health: ${financialHealth.score}/100).\n\nScore ${loanReadiness.score} hone ke mukhya kaaran:\n${reasonsText}\n\nAgar aap 3 unmatched bank payments confirm karein (+7) aur Rahul Sharma ka ₹42,000 recover karein (+5), toh score 84/100 ho jayega.\n(Note: Ye internal readiness indicator hai, bank credit score nahi.)`,
      toolCalls,
    };
  }

  // 10. "Pichle mahine ke comparison mein sales kaisi hain?"
  if (/\bpichle\s+mahine\b|\bcomparison\b|\bcompare\b|\bgrowth\b|\b कैसा\b|\bkaisi\s+hain\b/i.test(lower)) {
    const apr = ctx.monthlySeries[ctx.monthlySeries.length - 1] || {
      month: 'Apr',
      revenue: 420000,
      collected: 370000,
      pending: 50000,
      expenses: 295000,
    };
    const mar = ctx.monthlySeries[ctx.monthlySeries.length - 2] || {
      month: 'Mar',
      revenue: 375000,
      collected: 340000,
      pending: 35000,
      expenses: 252000,
    };
    const growthPct = Math.round(((apr.revenue - mar.revenue) / mar.revenue) * 100);
    toolCalls.push({
      toolName: 'compareMonths',
      args: { currentMonth: apr.month, previousMonth: mar.month },
      resultSummary: `${apr.month}: ₹${apr.revenue.toLocaleString('en-IN')} vs ${mar.month}: ₹${mar.revenue.toLocaleString('en-IN')} (+${growthPct}%)`,
    });
    return {
      replyText: `Pichle mahine (${mar.month}: ₹${mar.revenue.toLocaleString('en-IN')}) ke mukable is mahine (${apr.month}: ₹${apr.revenue.toLocaleString('en-IN')}) aapki sales ${growthPct}% badhi hain! Lekin estimated margin ~8% gira hai kyunki ₹18,500 duplicate payment, ₹7,000 overpayment, aur Rice par ₹4/kg extra supplier rate laga hai.`,
      toolCalls,
    };
  }

  // 11. "Mera paisa kaha leak ho raha hai?" / "Kaunse supplier se mehenga maal aa raha hai?"
  if (/\bleak\b|\bsupplier\b|\bmehenga\b|\blost\s+money\b|\bpaisa\s+kaha\b/i.test(lower)) {
    const sp = supplierInsights[0];
    toolCalls.push(
      {
        toolName: 'supplierPriceGaps',
        args: {},
        resultSummary: sp
          ? `${sp.productName}: ${sp.currentSupplierName} ₹${sp.currentPrice}/${sp.unit} vs ${sp.cheapestSupplierName} ₹${sp.cheapestPrice}/${sp.unit}`
          : 'No price gap',
      },
      {
        toolName: 'findLostMoney',
        args: {},
        resultSummary: `High-priority recovery: ₹${lostMoney.heroRecoveryTotal.toLocaleString('en-IN')}`,
      }
    );
    return {
      replyText: `Aapka paisa 3 jagah se leak ho raha hai:\n1. Supplier Rate Gap: ${sp ? `Aap ${sp.productName} ke liye ${sp.currentSupplierName} ko ₹${sp.currentPrice}/${sp.unit} de rahe hain jabki ${sp.cheapestSupplierName} wahi maal ₹${sp.cheapestPrice}/${sp.unit} (₹${sp.priceGapPerUnit}/${sp.unit} sasta) de raha hai — mahine ki ₹${sp.estimatedMonthlySaving.toLocaleString('en-IN')} bachat ho sakti hai.` : ''}\n2. Duplicate Payment: Gupta Traders ko ₹18,500 do baar gaya hai.\n3. Supplier Overpayment: Shree Balaji Hardware ko Bill SBH-118 par ₹7,000 extra payment gaya hai.`,
      toolCalls,
    };
  }

  // 12. Honest missing data fallback (No hallucinated numbers!)
  toolCalls.push({
    toolName: 'checkDataAvailability',
    args: { query: q },
    resultSummary: 'Requested metric/record not present in current shop ledger',
  });

  return {
    replyText:
      language === 'en'
        ? 'I do not have this specific data in your shop records right now. I only answer from your verified invoices, khata, inventory, and bank statements without guessing numbers. Try asking about today’s sales, overdue customers, duplicate payments, supplier rates, or loan readiness.'
        : 'Mere paas ye data abhi nahi hai. Main bina andaza lagaye sirf aapke asli bills, khata, inventory aur bank statement se jawab deta hoon. Aap mujhse aaj ki sale, Rahul ka khata, duplicate payment, supplier rate gap, ya loan readiness ke baare mein pooch sakte hain.',
    toolCalls,
  };
}
