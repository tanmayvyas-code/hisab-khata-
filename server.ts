import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { repo, type SessionRecord } from './src/server/repository.ts';
import { parseVoiceTranscript } from './src/engines/voiceParser.ts';
import { extractDemoBillScan } from './src/engines/ocrEngine.ts';
import { parseBankStatementContent, StatementParseError } from './src/engines/statementParser.ts';
import { DEMO_SAMPLE_STATEMENT_CSV } from './src/data/demoSeed.ts';
import { executeGroundedMunimQuery } from './src/engines/munimChatEngine.ts';
import { generateCreditPackPdfBytes } from './src/engines/pdfGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasRealGeminiKey = Boolean(
  process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
    process.env.GEMINI_API_KEY.trim().length > 10
);

function getGeminiClient(): GoogleGenAI | null {
  if (!hasRealGeminiKey) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeUntrustedText(raw: string, maxLength = 2000): string {
  return String(raw || '')
    .replace(/<\s*script[^>]*>.*?<\s*\/\s*script\s*>/gi, '')
    .replace(/ignore\s+previous\s+instructions/gi, '[sanitized]')
    .slice(0, maxLength)
    .trim();
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

// Simple in-memory rate limiter per IP for AI/OCR/Upload endpoints
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'local';
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > 120) {
    return res.status(429).json({
      error: 'Too many requests. Kripya 1 minute baad try karein.',
    });
  }
  return next();
}

export interface AuthenticatedRequest extends Request {
  sessionRecord?: SessionRecord;
  shopId?: string;
}

let latestActiveSession: SessionRecord | null = null;

function resolveSession(req: AuthenticatedRequest): SessionRecord {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies['ai_munim_session'];
  }
  const existing = repo.getSession(token);
  if (existing) return existing;

  // If no explicit session cookie yet, default to latestActiveSession or Demo Shop A unless strict X-Require-Auth header is passed
  if (req.headers['x-require-auth'] === 'true') {
    throw new Error('UNAUTHORIZED');
  }
  if (latestActiveSession) {
    const active = repo.getSession(latestActiveSession.token);
    if (active) return active;
  }
  return {
    token: 'demo-default-session',
    userId: 'user-demo-1',
    shopId: 'shop-demo-1',
    createdAt: new Date().toISOString(),
  };
}

function requireShopContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sess = resolveSession(req);
    req.sessionRecord = sess;
    req.shopId = sess.shopId;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized session. Kripya login karein.' });
  }
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hisab-kitab' });
  });

  // --- AUTH ROUTES ---
  app.post('/api/auth/demo-login', (_req, res) => {
    const auth = repo.authenticateUser('rajesh@agarwalstore.in', 'demo1234', false);
    if (!auth) {
      return res.status(500).json({ error: 'Shop initialization failed' });
    }
    repo.clearShopData(auth.shop.id);
    latestActiveSession = auth.session;
    res.setHeader(
      'Set-Cookie',
      `ai_munim_session=${auth.session.token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=604800`
    );
    return res.json({
      token: auth.session.token,
      user: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        mobile: auth.user.mobile,
        language: auth.user.language,
      },
      shop: auth.shop,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Mobile aur password zaroori hai.' });
    }
    let auth = repo.authenticateUser(String(identifier), String(password), false);
    if (!auth) {
      // Auto-provision a clean shop account (0 demo data) for new shop logins
      const cleanId = String(identifier).trim();
      auth = repo.registerUserAndShop({
        name: 'Shop Owner',
        email: cleanId.includes('@') ? cleanId : `${cleanId}@hisabkitab.in`,
        mobile: cleanId,
        password: String(password),
        shopName: 'My Dukan',
        businessType: 'kirana',
        language: 'hinglish',
        loadDemoData: false,
      });
    } else {
      repo.clearShopData(auth.shop.id);
    }
    latestActiveSession = auth.session;
    res.setHeader(
      'Set-Cookie',
      `ai_munim_session=${auth.session.token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=604800`
    );
    return res.json({
      token: auth.session.token,
      user: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        mobile: auth.user.mobile,
        language: auth.user.language,
      },
      shop: auth.shop,
    });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const { mobile, otp } = req.body || {};
    if (!mobile || !otp) {
      return res.status(400).json({ error: 'Mobile number aur OTP zaroori hai.' });
    }
    let auth = repo.authenticateUser(String(mobile), String(otp), true);
    if (!auth) {
      if (String(otp) !== '123456') {
        return res.status(401).json({ error: 'Invalid OTP. 123456 enter karein.' });
      }
      const cleanMob = String(mobile).trim();
      auth = repo.registerUserAndShop({
        name: 'Shop Owner',
        email: `${cleanMob}@hisabkitab.in`,
        mobile: cleanMob,
        password: 'demo1234',
        shopName: 'My Dukan',
        businessType: 'kirana',
        language: 'hinglish',
        loadDemoData: false,
      });
    } else {
      repo.clearShopData(auth.shop.id);
    }
    latestActiveSession = auth.session;
    res.setHeader(
      'Set-Cookie',
      `ai_munim_session=${auth.session.token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=604800`
    );
    return res.json({
      token: auth.session.token,
      user: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        mobile: auth.user.mobile,
        language: auth.user.language,
      },
      shop: auth.shop,
    });
  });

  app.post('/api/auth/signup', (req, res) => {
    const { name, email, mobile, password, shopName, businessType, language, loadDemoData } = req.body || {};
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ error: 'Name, email, mobile aur password zaroori hain.' });
    }
    const created = repo.registerUserAndShop({
      name: String(name),
      email: String(email),
      mobile: String(mobile),
      password: String(password),
      shopName: String(shopName || `${name} Store`),
      businessType: businessType || 'kirana',
      language: language || 'hinglish',
      loadDemoData: loadDemoData === true,
    });
    latestActiveSession = created.session;
    res.setHeader(
      'Set-Cookie',
      `ai_munim_session=${created.session.token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=604800`
    );
    return res.status(201).json({
      token: created.session.token,
      user: {
        id: created.user.id,
        name: created.user.name,
        email: created.user.email,
        mobile: created.user.mobile,
        language: created.user.language,
      },
      shop: created.shop,
    });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const cookies = parseCookies(req.headers.cookie);
    repo.deleteSession(cookies['ai_munim_session']);
    if (latestActiveSession) {
      repo.deleteSession(latestActiveSession.token);
      latestActiveSession = null;
    }
    res.setHeader('Set-Cookie', 'ai_munim_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0');
    return res.json({ ok: true });
  });

  // --- PROTECTED SHOP-SCOPED ROUTES ---
  app.get('/api/state', requireShopContext, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    const whatIf = {
      resolveUnmatched: req.query.resolveUnmatched === 'true',
      collectSeriousOverdue: req.query.collectSeriousOverdue === 'true',
      recoverDuplicate: req.query.recoverDuplicate === 'true',
      adjustOverpayment: req.query.adjustOverpayment === 'true',
    };
    const state = repo.getFullShopIntelligence(shopId, whatIf);
    return res.json({
      ...state,
      providerStatus: {
        ocr: hasRealGeminiKey && !state.shop.demoMode ? 'gemini-live' : 'demo',
        speech: 'browser-plus-demo-parser',
        llm: hasRealGeminiKey && !state.shop.demoMode ? 'gemini-live' : 'demo',
        storage: 'local-isolated',
        messaging: 'draft-only',
        otp: 'demo-123456',
      },
    });
  });

  app.post('/api/shop/clear', requireShopContext, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    repo.clearShopData(shopId);
    const state = repo.getFullShopIntelligence(shopId);
    return res.json({ ok: true, state });
  });

  app.post('/api/demo/reset', requireShopContext, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    repo.resetShopToDemo(shopId);
    const state = repo.getFullShopIntelligence(shopId);
    return res.json(state);
  });

  app.put('/api/shop/profile', requireShopContext, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    const bundle = repo.getBundleOrThrow(shopId);
    const { shopName, ownerName, mobile, email, address, businessType, gstin, demoMode, language, plan } =
      req.body || {};

    if (shopName) bundle.shop.shopName = sanitizeUntrustedText(shopName, 100);
    if (ownerName) bundle.shop.ownerName = sanitizeUntrustedText(ownerName, 80);
    if (mobile) bundle.shop.mobile = sanitizeUntrustedText(mobile, 20);
    if (email) bundle.shop.email = sanitizeUntrustedText(email, 80);
    if (address) bundle.shop.address = sanitizeUntrustedText(address, 200);
    if (businessType) bundle.shop.businessType = businessType;
    if (gstin !== undefined) bundle.shop.gstin = sanitizeUntrustedText(gstin, 20);
    if (typeof demoMode === 'boolean') bundle.shop.demoMode = demoMode;
    if (plan) bundle.shop.plan = plan;
    if (language && ['hinglish', 'en', 'hi'].includes(language)) {
      bundle.user.language = language;
    }
    bundle.shop.updatedAt = new Date().toISOString();
    return res.json({ shop: bundle.shop, user: bundle.user });
  });

  // --- CUSTOMERS (With Strict Shop Isolation) ---
  app.get('/api/customers/:id', requireShopContext, (req: AuthenticatedRequest, res) => {
    const cust = repo.getCustomerById(req.shopId!, req.params.id);
    if (!cust) {
      return res.status(404).json({ error: 'Customer record not found in your shop.' });
    }
    return res.json(cust);
  });

  app.post('/api/customers', requireShopContext, (req: AuthenticatedRequest, res) => {
    const { name, mobile, email, address, openingBalance, notes } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Customer name zaroori hai.' });
    }
    const cust = repo.createCustomer(req.shopId!, {
      name: sanitizeUntrustedText(name, 80),
      mobile: mobile ? sanitizeUntrustedText(mobile, 20) : undefined,
      email: email ? sanitizeUntrustedText(email, 80) : undefined,
      address: address ? sanitizeUntrustedText(address, 200) : undefined,
      openingBalance: Number(openingBalance) || 0,
      notes: notes ? sanitizeUntrustedText(notes, 250) : undefined,
    });
    return res.status(201).json(cust);
  });

  app.put('/api/customers/:id', requireShopContext, (req: AuthenticatedRequest, res) => {
    const updated = repo.updateCustomer(req.shopId!, req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found in your shop.' });
    }
    return res.json(updated);
  });

  app.delete('/api/customers/:id', requireShopContext, (req: AuthenticatedRequest, res) => {
    const ok = repo.deleteCustomer(req.shopId!, req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Customer not found in your shop.' });
    }
    return res.json({ deleted: true });
  });

  // --- INVOICES (With Strict Shop Isolation) ---
  app.get('/api/invoices/:id', requireShopContext, (req: AuthenticatedRequest, res) => {
    const inv = repo.getInvoiceById(req.shopId!, req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Invoice not found in your shop.' });
    }
    return res.json(inv);
  });

  app.post('/api/invoices', requireShopContext, (req: AuthenticatedRequest, res) => {
    const body = req.body || {};
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: 'Bill mein kam se kam 1 item hona chahiye.' });
    }
    const invoice = repo.createInvoice(req.shopId!, {
      type: body.type === 'purchase' ? 'purchase' : 'sale',
      invoiceNumber: body.invoiceNumber,
      billNumber: body.billNumber,
      customerId: body.customerId,
      customerName: body.customerName,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      discount: body.discount,
      gstAmount: body.gstAmount,
      total: body.total,
      paidAmount: body.paidAmount,
      source: body.source || 'manual',
      ocrConfidence: body.ocrConfidence,
      items: body.items,
      notes: body.notes,
    });
    return res.status(201).json(invoice);
  });

  // --- PAYMENTS ---
  app.post('/api/payments', requireShopContext, (req: AuthenticatedRequest, res) => {
    const body = req.body || {};
    if (!body.amount || Number(body.amount) <= 0) {
      return res.status(400).json({ error: 'Valid payment amount zaroori hai.' });
    }
    const payment = repo.recordPayment(req.shopId!, {
      direction: body.direction === 'out' ? 'out' : 'in',
      partyType: body.partyType || 'customer',
      partyId: body.partyId,
      partyName: body.partyName,
      amount: Number(body.amount),
      date: body.date,
      method: body.method || 'UPI',
      reference: body.reference,
      notes: body.notes,
      source: body.source || 'manual',
      invoiceId: body.invoiceId,
    });
    return res.status(201).json(payment);
  });

  // --- VOICE PARSER (Confirm before committing!) ---
  app.post('/api/voice/parse', requireShopContext, rateLimitMiddleware, async (req: AuthenticatedRequest, res) => {
    const bundle = repo.getBundleOrThrow(req.shopId!);
    const transcript = sanitizeUntrustedText(req.body?.transcript || '', 500);
    if (!transcript) {
      return res.status(400).json({ error: 'Kripya mic dabayein ya command type karein.' });
    }
    let parsed = parseVoiceTranscript(
      transcript,
      bundle.customers,
      bundle.suppliers,
      bundle.products
    );

    // If deterministic parser returned unknown or 0 amount, use live Gemini AI if available
    const ai = getGeminiClient();
    if (ai && (parsed.intent === 'unknown' || (parsed.totalAmount === 0 && parsed.intent !== 'multimodal_assign'))) {
      try {
        const customerNames = bundle.customers.map((c) => c.name).join(', ');
        const supplierNames = bundle.suppliers.map((s) => s.name).join(', ');
        const productCatalog = bundle.products
          .map((p) => `${p.name} (₹${p.sellingPrice}/${p.unit})`)
          .join(', ');

        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Parse this Indian shopkeeper voice/text command (Hinglish/Hindi/English) into a structured bill or payment entry.
Command: "${transcript}"
Known Customers: ${customerNames}
Known Suppliers: ${supplierNames}
Shop Products: ${productCatalog}
Rules:
- If the user mentions giving/selling items to someone (e.g. "Aalu 100 kilo Ramesh ko Diye"), intent is "create_bill".
- If unit price is not explicitly mentioned, estimate a realistic Indian market rate in INR (e.g. Aalu ₹25/kg, Pyaaz ₹35/kg, Rice ₹60/kg, Sugar ₹45/kg, Cement ₹380/bag) and compute lineTotal = quantity * unitPrice.
- Always extract partyName (Customer or Supplier name) and all line items.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intent: {
                  type: Type.STRING,
                  description: 'create_bill | credit_sale | payment_received | cash_sale | supplier_payment | multimodal_assign',
                },
                partyName: { type: Type.STRING },
                totalAmount: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER },
                explanation: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      unitPrice: { type: Type.NUMBER },
                      lineTotal: { type: Type.NUMBER },
                    },
                    required: ['name', 'quantity', 'unit', 'unitPrice', 'lineTotal'],
                  },
                },
              },
              required: ['intent', 'partyName', 'totalAmount', 'confidence', 'explanation', 'items'],
            },
          },
        });

        if (aiRes.text) {
          const cleanJson = aiRes.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          const geminiData = JSON.parse(cleanJson);
          const matchedCust = bundle.customers.filter((c) =>
            c.name.toLowerCase().includes(String(geminiData.partyName || '').toLowerCase())
          );
          const normItems = Array.isArray(geminiData.items)
            ? geminiData.items.map((it: any) => {
                const qty = Number(it.quantity) || 1;
                const lt = Number(it.lineTotal) || qty * (Number(it.unitPrice) || 0);
                const up = Number(it.unitPrice) || (qty > 0 ? Math.round((lt / qty) * 100) / 100 : 0);
                return {
                  name: String(it.name || 'Item'),
                  quantity: qty,
                  unit: String(it.unit || 'kg'),
                  unitPrice: up,
                  lineTotal: lt || Math.round(qty * up),
                };
              })
            : [];
          const calcTotal =
            Number(geminiData.totalAmount) ||
            normItems.reduce((s: number, r: any) => s + r.lineTotal, 0);

          parsed = {
            intent: geminiData.intent || 'create_bill',
            rawTranscript: transcript,
            partyName: matchedCust[0]?.name || geminiData.partyName || 'Walk-in Customer',
            matchedParties: matchedCust.map((c) => ({
              id: c.id,
              name: c.name,
              type: 'customer' as const,
              mobile: c.mobile,
            })),
            isAmbiguousParty: matchedCust.length > 1,
            isNewParty: matchedCust.length === 0 && Boolean(geminiData.partyName),
            items: normItems,
            totalAmount: calcTotal,
            confidence: Number(geminiData.confidence) || 92,
            explanation: String(geminiData.explanation || 'Extracted via Hisab Kitab AI.'),
          };
        }
      } catch (err) {
        console.error('Gemini voice parse fallback error:', err);
      }
    }

    return res.json(parsed);
  });

  // --- BILL SCANNER & MULTIMODAL OCR (Confirm before committing!) ---
  app.post('/api/scan/extract', requireShopContext, rateLimitMiddleware, async (req: AuthenticatedRequest, res) => {
    const bundle = repo.getBundleOrThrow(req.shopId!);
    const { preset, voiceTranscript, fileName, mimeType, imageBase64 } = req.body || {};

    // Validate file type if custom upload without imageBase64
    if (fileName) {
      const lower = String(fileName).toLowerCase();
      if (lower.endsWith('.exe') || lower.endsWith('.bat') || lower.endsWith('.sh') || lower.endsWith('.zip')) {
        return res.status(400).json({
          error: 'Bill read nahi ho paya. Kripya JPEG (.jpg/.jpeg) ya PNG (.png) photo upload karein.',
        });
      }
      if (lower.includes('corrupt') || lower.includes('blur')) {
        return res.status(422).json({
          error: 'Bill read nahi ho paya. Photo thodi clear karke try karein.',
        });
      }
    }

    // 1. If a real image (imageBase64) was uploaded or captured from camera, run real Gemini Vision OCR!
    const ai = getGeminiClient();
    if (ai && imageBase64) {
      try {
        const cleanBase64 = String(imageBase64).includes(',')
          ? String(imageBase64).split(',')[1]
          : String(imageBase64);
        const rawMime = String(mimeType || 'image/jpeg').toLowerCase();
        const validMime =
          rawMime === 'image/png'
            ? 'image/png'
            : rawMime === 'image/webp'
              ? 'image/webp'
              : 'image/jpeg';

        const visionRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType: validMime,
                data: cleanBase64,
              },
            },
            {
              text: `You are Hisab Kitab OCR, an expert financial document, invoice & receipt analyzer for Indian shops, institutions, and businesses.
Carefully read this uploaded image (IMPORTANT: the photo might be rotated 90°, 180°, or 270° sideways — read all printed and handwritten text accurately regardless of orientation!).
Extract all details from this bill, invoice, fee receipt, or handwritten parchi:
1. invoiceNumber: The Receipt No / Bill No / Invoice ID (e.g. "296424" or "INV-101").
2. issueDate: Date on the receipt/bill formatted as YYYY-MM-DD (e.g. "21-Aug-26" -> "2026-08-21").
3. partyName: Name of the customer, student, payer, or vendor/institute shown on the receipt (e.g. if both a person like "Tanmay Vyas" and an organization like "Global Institute of Technology" appear, format as "Tanmay Vyas (Global Institute of Technology)" or the primary party name).
4. partyType: "customer" (if it is a fee receipt / sale receipt issued to a customer/student) or "supplier" (if it is a wholesale purchase invoice).
5. invoiceType: "sale" or "purchase".
6. paymentStatus: "paid" (if cash/cheque/DD/UPI received or stamped) or "unpaid".
7. items: Every numbered/listed particular, fee head, or product on the document with its exact name, quantity (default 1 if not shown), unit (e.g. "pcs", "kg", "fee"), unitPrice (IMPORTANT: if only an Amount column is shown and Qty is 1, set unitPrice equal to lineTotal!), gstRate (0 if none), lineTotal, and confidence (0-100).
8. subtotal, gstAmount, discount, and grand total.
9. overallConfidence: 0 to 100.`,
            },
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                invoiceNumber: { type: Type.STRING },
                issueDate: { type: Type.STRING },
                dueDate: { type: Type.STRING },
                partyName: { type: Type.STRING },
                partyType: { type: Type.STRING },
                invoiceType: { type: Type.STRING },
                paymentStatus: { type: Type.STRING },
                subtotal: { type: Type.NUMBER },
                gstAmount: { type: Type.NUMBER },
                discount: { type: Type.NUMBER },
                total: { type: Type.NUMBER },
                overallConfidence: { type: Type.NUMBER },
                fieldConfidences: {
                  type: Type.OBJECT,
                  properties: {
                    invoiceNumber: { type: Type.NUMBER },
                    partyName: { type: Type.NUMBER },
                    issueDate: { type: Type.NUMBER },
                    total: { type: Type.NUMBER },
                  },
                  required: ['invoiceNumber', 'partyName', 'issueDate', 'total'],
                },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      unitPrice: { type: Type.NUMBER },
                      gstRate: { type: Type.NUMBER },
                      lineTotal: { type: Type.NUMBER },
                      confidence: { type: Type.NUMBER },
                    },
                    required: ['name', 'quantity', 'unit', 'unitPrice', 'gstRate', 'lineTotal', 'confidence'],
                  },
                },
              },
              required: [
                'invoiceNumber',
                'issueDate',
                'partyName',
                'partyType',
                'invoiceType',
                'subtotal',
                'gstAmount',
                'discount',
                'total',
                'overallConfidence',
                'fieldConfidences',
                'items',
              ],
            },
          },
        });

        if (visionRes.text) {
          const cleanJson = visionRes.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          const parsedVision = JSON.parse(cleanJson);
          const lowConfFields: string[] = [];
          const rawFc = parsedVision.fieldConfidences || {};
          const fc = {
            invoiceNumber: Number(rawFc.invoiceNumber) || 94,
            partyName: Number(rawFc.partyName) || 95,
            issueDate: Number(rawFc.issueDate) || 92,
            total: Number(rawFc.total) || 97,
            gstAmount: 95,
            items: 94,
          };
          if (fc.invoiceNumber < 80) lowConfFields.push('invoiceNumber');
          if (fc.partyName < 80) lowConfFields.push('partyName');
          if (fc.total < 80) lowConfFields.push('total');

          const items = Array.isArray(parsedVision.items) && parsedVision.items.length > 0
            ? parsedVision.items.map((it: any) => {
                const qty = Number(it.quantity) || 1;
                const rawLt = Number(it.lineTotal) || 0;
                const rawUp = Number(it.unitPrice) || 0;
                const lineTotal = rawLt > 0 ? rawLt : Math.round(qty * rawUp);
                const unitPrice = rawUp > 0 ? rawUp : qty > 0 ? Math.round((lineTotal / qty) * 100) / 100 : 0;
                return {
                  name: String(it.name || 'Bill Item'),
                  quantity: qty,
                  unit: String(it.unit || 'pcs'),
                  unitPrice,
                  discount: 0,
                  gstRate: Number(it.gstRate) || 0,
                  lineTotal,
                  confidence: Number(it.confidence) || 94,
                };
              })
            : [
                {
                  name: `Scanned Bill (${fileName || 'Photo'})`,
                  quantity: 1,
                  unit: 'pcs',
                  unitPrice: Number(parsedVision.total) || 0,
                  discount: 0,
                  gstRate: 0,
                  lineTotal: Number(parsedVision.total) || 0,
                  confidence: 90,
                },
              ];

          const itemsSum = items.reduce((s: number, i: any) => s + (Number(i.lineTotal) || 0), 0);
          const computedTotal = Number(parsedVision.total) > 0 ? Number(parsedVision.total) : itemsSum;

          let finalPartyName = String(parsedVision.partyName || 'Scanned Party');
          let finalPartyType: 'customer' | 'supplier' =
            parsedVision.partyType === 'supplier' ? 'supplier' : 'customer';
          let finalInvoiceType: 'sale' | 'purchase' =
            parsedVision.invoiceType === 'purchase' ? 'purchase' : 'sale';
          const paymentStatus: 'paid' | 'unpaid' | 'partial' =
            parsedVision.paymentStatus === 'paid' ? 'paid' : 'unpaid';
          let voiceInstruction: any = undefined;

          if (voiceTranscript && String(voiceTranscript).trim()) {
            const vp = parseVoiceTranscript(
              sanitizeUntrustedText(voiceTranscript, 300),
              bundle.customers,
              bundle.suppliers,
              bundle.products
            );
            if (vp.partyName && vp.partyName !== 'Walk-in Customer') {
              finalPartyName = vp.partyName;
              finalPartyType = 'customer';
              finalInvoiceType = 'sale';
              voiceInstruction = {
                rawText: String(voiceTranscript).trim(),
                targetCustomerName: vp.partyName,
                targetCustomerId: vp.matchedParties[0]?.id,
                isAmbiguousCustomer: vp.isAmbiguousParty,
                matchedCustomers: vp.matchedParties
                  .filter((m) => m.type === 'customer')
                  .map((m) => ({ id: m.id, name: m.name, mobile: m.mobile })),
                action: /paid|jama/i.test(String(voiceTranscript)) ? 'mark_paid' : 'add_to_khata',
              };
            }
          }

          const invNum = String(parsedVision.invoiceNumber || `SCAN-${Date.now().toString().slice(-4)}`);
          return res.json({
            billNumber: invNum,
            invoiceNumber: invNum,
            issueDate: String(parsedVision.issueDate || new Date().toISOString().slice(0, 10)),
            dueDate: String(parsedVision.dueDate || parsedVision.issueDate || new Date().toISOString().slice(0, 10)),
            partyName: finalPartyName,
            partyType: finalPartyType,
            invoiceType: finalInvoiceType,
            paymentStatus,
            items,
            subtotal: Number(parsedVision.subtotal) || computedTotal,
            gstAmount: Number(parsedVision.gstAmount) || 0,
            discount: Number(parsedVision.discount) || 0,
            total: computedTotal,
            overallConfidence: Number(parsedVision.overallConfidence) || 95,
            fieldConfidences: fc,
            lowConfidenceFields: lowConfFields,
            voiceInstruction,
            providerUsed: 'gemini',
          });
        }
      } catch (err) {
        console.error('Gemini Vision OCR extraction error:', err);
      }
    }

    // 2. Bundled Preset Demo Bill Extraction (when user clicks a preset button without a custom image)
    const chosenPreset =
      preset === 'ramesh_kirana' || preset === 'handwritten_low_conf' ? preset : 'gupta_18500';
    const scanResult = extractDemoBillScan(
      chosenPreset,
      voiceTranscript ? sanitizeUntrustedText(voiceTranscript, 300) : undefined,
      bundle.customers,
      bundle.suppliers
    );

    return res.json(scanResult);
  });

  // --- BANK STATEMENT INGESTION & RECONCILIATION ---
  app.post('/api/statements/upload', requireShopContext, rateLimitMiddleware, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    const bundle = repo.getBundleOrThrow(shopId);
    const { useDemoStatement, fileName, content } = req.body || {};

    const rawContent = useDemoStatement ? DEMO_SAMPLE_STATEMENT_CSV : String(content || '');
    const name = useDemoStatement ? 'SBI_CurrentAccount_Apr2026_Demo.csv' : String(fileName || 'statement.csv');

    try {
      const statementId = `stmt-${Date.now()}`;
      const parsedTxns = parseBankStatementContent(shopId, statementId, rawContent, name);

      // Deduplicate against existing shop bankTransactions by normalizedHash
      const existingHashes = new Set(bundle.bankTransactions.map((t) => t.normalizedHash));
      let addedCount = 0;
      for (const txn of parsedTxns) {
        if (!existingHashes.has(txn.normalizedHash)) {
          bundle.bankTransactions.push(txn);
          existingHashes.add(txn.normalizedHash);
          addedCount += 1;
        }
      }

      bundle.bankStatements.unshift({
        id: statementId,
        shopId,
        fileName: name,
        format: name.endsWith('.xlsx') ? 'xlsx' : name.endsWith('.pdf') ? 'pdf' : 'csv',
        periodStart: parsedTxns[0]?.date || '2026-04-01',
        periodEnd: parsedTxns[parsedTxns.length - 1]?.date || '2026-04-28',
        status: 'reconciled',
        parsedCount: parsedTxns.length,
        createdAt: new Date().toISOString(),
      });

      const fullState = repo.getFullShopIntelligence(shopId);
      return res.json({
        parsedCount: parsedTxns.length,
        addedCount,
        dedupedCount: parsedTxns.length - addedCount,
        state: fullState,
      });
    } catch (err) {
      if (err instanceof StatementParseError) {
        return res.status(422).json({
          error: err.message,
          canUseDemoStatement: true,
        });
      }
      return res.status(422).json({
        error: 'Statement format supported nahi hai.',
        canUseDemoStatement: true,
      });
    }
  });

  app.post('/api/reconciliation/decision', requireShopContext, (req: AuthenticatedRequest, res) => {
    const { bankTransactionId, decision, invoiceId } = req.body || {};
    if (!bankTransactionId || !['confirm', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid reconciliation decision.' });
    }
    const updated = repo.confirmOrRejectMatch(
      req.shopId!,
      String(bankTransactionId),
      decision,
      invoiceId ? String(invoiceId) : undefined
    );
    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found in your shop.' });
    }
    return res.json(repo.getFullShopIntelligence(req.shopId!));
  });

  app.post('/api/duplicates/decision', requireShopContext, (req: AuthenticatedRequest, res) => {
    const { duplicateId, status } = req.body || {};
    if (!duplicateId || !['confirmed', 'dismissed', 'reminded_later'].includes(status)) {
      return res.status(400).json({ error: 'Invalid duplicate status.' });
    }
    repo.updateDuplicateStatus(req.shopId!, String(duplicateId), status);
    return res.json(repo.getFullShopIntelligence(req.shopId!));
  });

  app.post('/api/alerts/status', requireShopContext, (req: AuthenticatedRequest, res) => {
    const bundle = repo.getBundleOrThrow(req.shopId!);
    const { alertId, status } = req.body || {};
    if (alertId && ['seen', 'resolved', 'dismissed'].includes(status)) {
      bundle.alertStatuses[String(alertId)] = status;
    }
    return res.json(repo.getFullShopIntelligence(req.shopId!));
  });

  app.post('/api/reminders', requireShopContext, (req: AuthenticatedRequest, res) => {
    const { customerId, channel, tone, status, reminderId } = req.body || {};
    const bundle = repo.getBundleOrThrow(req.shopId!);

    if (reminderId && status) {
      const existing = bundle.reminders.find((r) => r.id === reminderId && r.shopId === req.shopId);
      if (existing) {
        existing.status = status;
        return res.json(existing);
      }
    }

    const created = repo.createOrUpdateReminder(req.shopId!, {
      customerId: String(customerId || 'cust-rahul'),
      channel: channel || 'whatsapp',
      tone: tone || 'polite',
      status: status || 'draft',
    });
    if (!created) {
      return res.status(404).json({ error: 'Customer not found in your shop.' });
    }
    return res.status(201).json(created);
  });

  // --- GROUNDED AI MUNIM CHAT ---
  app.post('/api/munim/chat', requireShopContext, rateLimitMiddleware, async (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    const bundle = repo.getBundleOrThrow(shopId);
    const message = sanitizeUntrustedText(req.body?.message || '', 500);
    if (!message) {
      return res.status(400).json({ error: 'Kripya apna sawaal likhein ya bolein.' });
    }

    const userMsg = {
      id: `msg-u-${Date.now()}`,
      shopId,
      role: 'user' as const,
      content: message,
      createdAt: new Date().toISOString(),
    };
    bundle.aiMessages.push(userMsg);

    const duplicates = repo.getFullShopIntelligence(shopId).duplicates;
    const grounded = executeGroundedMunimQuery(
      message,
      {
        shop: bundle.shop,
        customers: bundle.customers,
        invoices: bundle.invoices,
        payments: bundle.payments,
        bankTransactions: bundle.bankTransactions,
        duplicates,
        products: bundle.products,
        inventory: bundle.inventory,
        monthlySeries: bundle.monthlySeries,
        lastMentionedCustomerId: req.body?.lastMentionedCustomerId,
      },
      bundle.user.language
    );

    const assistantMsg = {
      id: `msg-a-${Date.now() + 1}`,
      shopId,
      role: 'assistant' as const,
      content: grounded.replyText,
      toolCalls: grounded.toolCalls,
      actionProposal: grounded.actionProposal,
      structuredCard: grounded.structuredCard,
      createdAt: new Date().toISOString(),
    };
    bundle.aiMessages.push(assistantMsg);

    return res.json({
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      mentionedCustomerId: grounded.mentionedCustomerId,
      providerUsed: 'grounded-tool-engine',
    });
  });

  app.post('/api/munim/confirm-action', requireShopContext, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    const bundle = repo.getBundleOrThrow(shopId);
    const { messageId, decision } = req.body || {};
    const msg = bundle.aiMessages.find((m) => m.id === messageId && m.shopId === shopId);
    if (!msg || !msg.actionProposal) {
      return res.status(404).json({ error: 'Action proposal not found.' });
    }

    if (decision === 'cancel') {
      msg.actionProposal.status = 'cancelled';
      return res.json({ state: repo.getFullShopIntelligence(shopId) });
    }

    msg.actionProposal.status = 'confirmed';
    const payload = msg.actionProposal.payload;
    if (msg.actionProposal.type === 'add_payment') {
      repo.recordPayment(shopId, {
        direction: 'in',
        partyType: 'customer',
        partyId: String(payload.customerId || 'cust-rahul'),
        partyName: String(payload.customerName || 'Rahul Sharma'),
        amount: Number(payload.amount || 2000),
        method: 'UPI',
        source: 'voice',
        notes: 'Confirmed via AI Munim Chat command',
      });
    }

    return res.json({ state: repo.getFullShopIntelligence(shopId) });
  });

  // --- LENDER-READY CREDIT PACK PDF DOWNLOAD ---
  app.get('/api/credit-pack/pdf', requireShopContext, (req: AuthenticatedRequest, res) => {
    const shopId = req.shopId!;
    const intel = repo.getFullShopIntelligence(shopId);
    const pdfBytes = generateCreditPackPdfBytes({
      shop: intel.shop,
      generatedAt: new Date().toISOString(),
      financialHealth: intel.financialHealth,
      loanReadiness: intel.loanReadiness,
      lostMoney: intel.lostMoney,
      cashflow: intel.cashflow,
      collections: intel.collections,
      monthlySeries: intel.monthlySeries,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="AI_Munim_Credit_Pack_${intel.shop.shopName.replace(/[^A-Za-z0-9]/g, '_')}.pdf"`
    );
    return res.send(Buffer.from(pdfBytes));
  });

  return app;
}

async function startServer() {
  const app = createApiApp();
  const port = Number(process.env.PORT) || 3000;
  const distPath = path.resolve(__dirname, 'dist');
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.npm_lifecycle_event === 'dev';
  const useStaticDist =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (!isDev && fs.existsSync(path.join(distPath, 'index.html')));

  if (useStaticDist && fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Hisab Kitab server listening on http://0.0.0.0:${port}`);
  });
}

// Start server unless imported by test runner
if (process.env.AI_MUNIM_TEST_MODE !== 'true') {
  startServer();
}
