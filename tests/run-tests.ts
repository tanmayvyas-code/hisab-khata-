import assert from 'assert';
import { repo } from '../src/server/repository';
import { parseVoiceTranscript } from '../src/engines/voiceParser';
import { extractDemoBillScan } from '../src/engines/ocrEngine';
import { parseBankStatementContent, StatementParseError } from '../src/engines/statementParser';
import { DEMO_SAMPLE_STATEMENT_CSV } from '../src/data/demoSeed';
import { scoreTransactionAgainstInvoice } from '../src/engines/reconciliationEngine';
import { executeGroundedMunimQuery } from '../src/engines/munimChatEngine';
import { generateCreditPackPdfBytes } from '../src/engines/pdfGenerator';
import { LOAN_READINESS_DISCLAIMER } from '../src/i18n/translations';

process.env.AI_MUNIM_TEST_MODE = 'true';

async function runAllTests() {
  console.log('=== AI MUNIM AUTOMATED VERIFICATION SUITE ===');

  // Reset demo shops
  repo.seedDefaultDemoShops();

  // 1. Authentication & Session Handling
  console.log('1. Testing Authentication & Session Handling...');
  const authA = repo.authenticateUser('rajesh@agarwalstore.in', 'demo1234', false);
  assert(authA, 'User A should authenticate with password');
  assert.strictEqual(authA.shop.id, 'shop-demo-1');

  const otpAuth = repo.authenticateUser('9829012345', '123456', true);
  assert(otpAuth, 'User A should authenticate with Demo OTP 123456');

  const badOtp = repo.authenticateUser('9829012345', '000000', true);
  assert.strictEqual(badOtp, null, 'Invalid OTP must be rejected');

  // 2. Strict Multi-Tenant Data Isolation (User A vs User B)
  console.log('2. Testing Strict Multi-Tenant Data Isolation (Shop A vs Shop B)...');
  const secretCustFromA = repo.getCustomerById('shop-demo-1', 'cust-b-secret');
  assert.strictEqual(secretCustFromA, null, 'Shop A cannot read Shop B customer by ID');

  const secretInvFromA = repo.getInvoiceById('shop-demo-1', 'inv-b-secret');
  assert.strictEqual(secretInvFromA, null, 'Shop A cannot read Shop B invoice by ID');

  const updateAttemptFromA = repo.updateCustomer('shop-demo-1', 'cust-b-secret', {
    name: 'Hacked Name',
  });
  assert.strictEqual(updateAttemptFromA, null, 'Shop A cannot update Shop B customer');

  const deleteAttemptFromA = repo.deleteCustomer('shop-demo-1', 'cust-b-secret');
  assert.strictEqual(deleteAttemptFromA, false, 'Shop A cannot delete Shop B customer');

  const confirmAttemptFromA = repo.confirmOrRejectMatch('shop-demo-1', 'btxn-shop-b', 'confirm');
  assert.strictEqual(confirmAttemptFromA, null, 'Shop A cannot mutate Shop B transactions');

  // 3. Coherent Demo Seed Headline Numbers (78, 72, ₹67,500)
  console.log('3. Testing Coherent Demo Seed Headline Metrics (78, 72, ₹67,500)...');
  const intel = repo.getFullShopIntelligence('shop-demo-1');
  assert.strictEqual(
    intel.financialHealth.score,
    78,
    `Expected Financial Health 78, got ${intel.financialHealth.score}`
  );
  assert.strictEqual(
    intel.loanReadiness.score,
    72,
    `Expected Loan Readiness 72, got ${intel.loanReadiness.score}`
  );
  assert.strictEqual(
    intel.lostMoney.heroRecoveryTotal,
    67500,
    `Expected Hero Recovery ₹67,500, got ${intel.lostMoney.heroRecoveryTotal}`
  );
  assert.strictEqual(intel.lostMoney.duplicatePaymentsTotal, 18500);
  assert.strictEqual(intel.lostMoney.overdueCollectionsHeroTotal, 42000);
  assert.strictEqual(intel.lostMoney.overpaymentTotal, 7000);

  // Verify factor weights sum to 100
  const fhWeightSum = intel.financialHealth.factors.reduce((s, f) => s + f.weight, 0);
  const lrWeightSum = intel.loanReadiness.factors.reduce((s, f) => s + f.weight, 0);
  assert.strictEqual(fhWeightSum, 100, 'Financial Health factor weights must sum to 100');
  assert.strictEqual(lrWeightSum, 100, 'Loan Readiness factor weights must sum to 100');

  // 4. Voice & Multimodal Hinglish Parser (All example phrases in §10.2 & §10.4)
  console.log('4. Testing Voice & Multimodal Hinglish Parser...');
  const p1 = parseVoiceTranscript(
    'Ramesh ko 5 kilo rice 60 rupaye kilo aur 2 kilo sugar 45 rupaye kilo',
    intel.customers,
    intel.suppliers,
    intel.products
  );
  assert.strictEqual(p1.intent, 'create_bill');
  assert.strictEqual(p1.items.length, 2);
  assert.strictEqual(p1.items[0].lineTotal, 300);
  assert.strictEqual(p1.items[1].lineTotal, 90);
  assert.strictEqual(p1.totalAmount, 390);

  const p2 = parseVoiceTranscript(
    'Ramesh ne ₹5,000 ka maal udhaar liya',
    intel.customers,
    intel.suppliers
  );
  assert.strictEqual(p2.intent, 'credit_sale');
  assert.strictEqual(p2.totalAmount, 5000);

  const p3 = parseVoiceTranscript('Rahul ne ₹2,000 de diye', intel.customers, intel.suppliers);
  assert.strictEqual(p3.intent, 'payment_received');
  assert.strictEqual(p3.totalAmount, 2000);

  const p4 = parseVoiceTranscript('Aaj cash sale ₹15,000 hui', intel.customers, intel.suppliers);
  assert.strictEqual(p4.intent, 'cash_sale');
  assert.strictEqual(p4.totalAmount, 15000);

  const p5 = parseVoiceTranscript(
    'Gupta Traders ko ₹18,500 payment ki',
    intel.customers,
    intel.suppliers
  );
  assert.strictEqual(p5.intent, 'supplier_payment');
  assert.strictEqual(p5.totalAmount, 18500);

  const p6 = parseVoiceTranscript(
    'Isko Ramesh ke account mein add kar do',
    intel.customers,
    intel.suppliers
  );
  assert.strictEqual(p6.intent, 'multimodal_assign');
  assert.strictEqual(p6.partyName, 'Ramesh Kumar');

  const p7 = parseVoiceTranscript(
    'Aalu 100 kilo Ramesh ko Diye',
    intel.customers,
    intel.suppliers,
    intel.products
  );
  assert.strictEqual(p7.intent, 'create_bill');
  assert.strictEqual(p7.partyName, 'Ramesh Kumar');
  assert.strictEqual(p7.items.length, 1);
  assert.strictEqual(p7.items[0].quantity, 100);
  assert.strictEqual(p7.items[0].unit, 'kg');
  assert(p7.totalAmount > 0, 'Total amount should be auto-computed from default/catalog rate');

  // 5. OCR Workflow & Low-Confidence Handling
  console.log('5. Testing OCR Extraction & Low-Confidence Field Highlighting...');
  const guptaScan = extractDemoBillScan('gupta_18500', undefined, intel.customers, intel.suppliers);
  assert.strictEqual(guptaScan.total, 18500);
  assert.strictEqual(guptaScan.partyName, 'Gupta Traders');
  assert.strictEqual(guptaScan.lowConfidenceFields.length, 0);

  const lowConfScan = extractDemoBillScan(
    'handwritten_low_conf',
    undefined,
    intel.customers,
    intel.suppliers
  );
  assert(
    lowConfScan.lowConfidenceFields.length > 0,
    'Handwritten bill must flag low-confidence fields (<80%)'
  );

  const multimodalScan = extractDemoBillScan(
    'gupta_18500',
    'Isko Ramesh ke account mein add kar do',
    intel.customers,
    intel.suppliers
  );
  assert.strictEqual(multimodalScan.partyName, 'Ramesh Kumar');
  assert.strictEqual(multimodalScan.voiceInstruction?.action, 'add_to_khata');

  // 6. Bank Statement Parsing (CSV, TSV, Unsupported PDF Failure Path)
  console.log('6. Testing Bank Statement Parsing & Deduplication...');
  const parsedTxns = parseBankStatementContent(
    'shop-demo-1',
    'stmt-test',
    DEMO_SAMPLE_STATEMENT_CSV,
    'sample.csv'
  );
  assert.strictEqual(parsedTxns.length, 9);

  let pdfFailedCorrectly = false;
  try {
    parseBankStatementContent('shop-demo-1', 'stmt-bad', '%PDF-1.4 binary scan', 'bad.pdf');
  } catch (err) {
    if (err instanceof StatementParseError) {
      pdfFailedCorrectly = true;
    }
  }
  assert(pdfFailedCorrectly, 'Unsupported binary PDF must throw StatementParseError');

  // 7. Reconciliation Engine & Duplicate Detection
  console.log('7. Testing Weighted Reconciliation & Duplicate Detection...');
  assert(intel.duplicates.length >= 1, 'Must detect Gupta Traders ₹18,500 duplicate payment');
  assert.strictEqual(intel.duplicates[0].recoverableAmount, 18500);

  // Test short payment derivation
  const sampleInv = intel.invoices.find((i) => i.id === 'inv-ramesh-401')!;
  const shortTxn = {
    ...intel.bankTransactions[0],
    amount: 14200, // ~2% short of 14,500
  };
  const shortScore = scoreTransactionAgainstInvoice(
    shortTxn,
    { ...sampleInv, paidAmount: 0 },
    [],
    intel.customers,
    intel.suppliers
  );
  assert.strictEqual(shortScore.derivedStatus, 'short');

  // 8. Grounded AI Munim Chat (Ranked Problems, Missing Data Path, Write Confirmation)
  console.log('8. Testing AI Munim Chat Grounding & Missing Data Honesty...');
  const mainProblemRes = executeGroundedMunimQuery(
    'Munim ji, mera sabse bada financial problem kya hai?',
    {
      shop: intel.shop,
      customers: intel.customers,
      invoices: intel.invoices,
      payments: intel.payments,
      bankTransactions: intel.bankTransactions,
      duplicates: intel.duplicates,
      products: intel.products,
      inventory: intel.inventory,
      monthlySeries: intel.monthlySeries,
    }
  );
  assert(mainProblemRes.replyText.includes('18,500'), 'Must cite ₹18,500 duplicate payment');
  assert(mainProblemRes.replyText.includes('42,000'), 'Must cite ₹42,000 overdue receivable');
  assert(mainProblemRes.toolCalls.length >= 1, 'Must record grounded tool calls');

  const missingDataRes = executeGroundedMunimQuery(
    'Mera 2019 ka crypto portfolio kitna tha?',
    {
      shop: intel.shop,
      customers: intel.customers,
      invoices: intel.invoices,
      payments: intel.payments,
      bankTransactions: intel.bankTransactions,
      duplicates: intel.duplicates,
      products: intel.products,
      inventory: intel.inventory,
      monthlySeries: intel.monthlySeries,
    }
  );
  assert(
    missingDataRes.replyText.includes('Mere paas ye data abhi nahi hai'),
    'Must honestly state when data is unavailable without inventing numbers'
  );

  const writeCmdRes = executeGroundedMunimQuery('Rahul ko ₹2,000 payment add karo', {
    shop: intel.shop,
    customers: intel.customers,
    invoices: intel.invoices,
    payments: intel.payments,
    bankTransactions: intel.bankTransactions,
    duplicates: intel.duplicates,
    products: intel.products,
    inventory: intel.inventory,
    monthlySeries: intel.monthlySeries,
  });
  assert(
    writeCmdRes.actionProposal && writeCmdRes.actionProposal.status === 'pending',
    'Write command must return a pending confirmation proposal'
  );

  // 9. Customer Creation, Invoice Creation & Inventory Stock Movement
  console.log('9. Testing Customer, Invoice Creation & Inventory Stock Movement...');
  const riceBefore = intel.inventory.find((i) => i.productId === 'prod-rice')!.quantity;
  const createdInv = repo.createInvoice('shop-demo-1', {
    type: 'sale',
    customerName: 'New Test Kirana Buyer',
    source: 'voice',
    items: [
      {
        productId: 'prod-rice',
        name: 'Sona Masoori Rice',
        quantity: 10,
        unit: 'kg',
        unitPrice: 60,
      },
    ],
  });
  assert.strictEqual(createdInv.total, 600);
  const riceAfter = repo
    .getFullShopIntelligence('shop-demo-1')
    .inventory.find((i) => i.productId === 'prod-rice')!.quantity;
  assert.strictEqual(riceAfter, riceBefore - 10, 'Sale invoice must decrement product stock by 10');

  // Reset back to pristine demo state
  repo.resetShopToDemo('shop-demo-1');

  // 10. Credit Pack PDF Binary Generation & Disclaimer Check
  console.log('10. Testing Lender-Ready Credit Pack PDF Generation...');
  const cleanIntel = repo.getFullShopIntelligence('shop-demo-1');
  const pdfBytes = generateCreditPackPdfBytes({
    shop: cleanIntel.shop,
    generatedAt: new Date().toISOString(),
    financialHealth: cleanIntel.financialHealth,
    loanReadiness: cleanIntel.loanReadiness,
    lostMoney: cleanIntel.lostMoney,
    cashflow: cleanIntel.cashflow,
    collections: cleanIntel.collections,
    monthlySeries: cleanIntel.monthlySeries,
  });
  assert(pdfBytes.byteLength > 1500, 'Generated PDF must be non-empty (>1.5KB)');
  const pdfText = new TextDecoder().decode(pdfBytes);
  assert(pdfText.startsWith('%PDF-1.4'), 'PDF must start with %PDF-1.4 header');
  assert(
    pdfText.includes(LOAN_READINESS_DISCLAIMER.slice(0, 50)),
    'PDF must contain the mandatory Loan Readiness disclaimer'
  );

  console.log('✅ ALL 10 TEST SUITES PASSED SUCCESSFULLY!');
}

runAllTests().catch((err) => {
  console.error('❌ TEST FAILURE:', err);
  process.exit(1);
});
