# AI Munim — Your Digital Munim for Money, Records & Business Decisions

> **Record less. Understand more. Recover money. Become loan-ready.**

AI Munim is a voice + vision powered financial copilot built for Indian MSMEs (kirana, hardware, medical, clothing, mobile shops, small traders, restaurants, and service businesses). It proactively answers three critical questions for a shopkeeper:
1. **Did I pay someone twice?** (**SAVE MONEY**)
2. **Who still owes me money?** (**GET MONEY**)
3. **Is my business ready for a loan?** (**GET READY**)

---

## Core Flow
**Capture → Understand → Reconcile → Alert → Recover → Advise**

- **Confirm Before Committing**: Voice, OCR, and AI chat commands never silently create or modify financial data. Every entry presents an editable confirmation card (`Confirm / Edit / Cancel`).
- **8-Signal Weighted Reconciliation**: Matches bank statement entries to bills across Amount (30), Invoice/Bill # in narration (20), Counterparty fuzzy similarity (15), UTR/Reference (10), Date proximity (10), Keywords (5), Party history (5), and Open balance fit (5). Low-confidence matches (`60–84%`) are routed to the **Payment Inbox** and never auto-assigned.
- **Find My Lost Money**: Surfaces **₹67,500** in high-priority evidence-backed recovery on the hero demo dataset:
  - **₹18,500** possible duplicate payment to Gupta Traders (`GT-INV-2026-402` paid on 19 Apr via UPI and 21 Apr via NEFT)
  - **₹42,000** seriously overdue receivable from Rahul Sharma (45 days overdue)
  - **₹7,000** supplier overpayment to Shree Balaji Hardware (`SBH-118`)
  - Plus secondary follow-up receivables (`Amit Traders ₹18,500`, `Raj ₹7,200`) and supplier price-gap intelligence (`₹4/kg` extra on Sona Masoori Rice with Supplier A vs Supplier B).
- **Explainable Scoring & Lender Credit Pack PDF**:
  - **Financial Health Score**: `78 / 100`
  - **Loan Readiness Score**: `72 / 100` (includes What-If Simulator and mandatory internal indicator disclaimer)
  - **1-Click Credit Pack PDF**: Generates a valid 2-page `%PDF-1.4` lender dossier with the mandatory disclaimer.

---

## Quick Start & Commands

```bash
# Install dependencies
npm install

# Run full-stack development server (Express API + Vite on port 3000)
npm run dev

# Run type-check / lint
npm run lint

# Run automated verification suite (Auth, Multi-Tenant Isolation, Voice, OCR, Reconciliation, Scores, Chat, PDF)
npm test

# Build for production
npm run build
```

---

## Demo Mode vs Production Integration

The entire hero demo runs with **zero external API keys** out of the box. All external integrations sit behind replaceable service interfaces:
- **OCR**: `extractDemoBillScan` (bundled sample invoices with per-field confidence) + server-side `@google/genai` (`gemini-3.8-flash`) when `GEMINI_API_KEY` is configured and Demo Mode is unchecked in Settings.
- **Voice & Multimodal Parser**: Browser Web Speech API (`hi-IN` / `en-IN`) + deterministic Hinglish/Hindi/English parser (`src/engines/voiceParser.ts`).
- **AI Munim Chat**: Tool-grounded engine (`src/engines/munimChatEngine.ts`) that only states numbers returned by internal shop queries and responds `"Mere paas ye data abhi nahi hai"` when asked about unrecorded data.
- **Messaging & Reminders**: Draft-only generator (`Copy` + `wa.me` link) clearly labelled as draft-only.

---

## 3-Minute Hero Demo Script

1. **Landing Page (`/`)**: Click **Try AI Munim (Instant Demo)** to open **Agarwal Kirana & Hardware Store**.
2. **Dashboard (`/dashboard`)**: Inspect the Hinglish Munim Summary, **Financial Health (78)**, **Loan Readiness (72)**, and **Potential Money Recovery (₹67,500)**.
3. **Bill Scanner (`/scan`)**: Select the bundled **Gupta Traders ₹18,500** bill (or attach the multimodal voice command *"Isko Ramesh ke account mein add kar do"*), inspect per-field confidence bars, and click **Confirm**.
4. **Bank Statements (`/bank-statements`)**: Click **Use Demo Statement (SBI April 2026)** to parse and normalize 9 bank entries with automatic `normalizedHash` deduplication.
5. **Reconciliation (`/reconciliation`)**: Inspect the **🚨 Possible duplicate payment** alert (`₹18,500` paid twice to Gupta Traders) and click **Why Score?** on any transaction to see the 8-signal breakdown.
6. **Customers & Reminders (`/customers/cust-rahul`)**: View Rahul Sharma's `₹42,000` (45 days overdue) khata and generate a Polite / Firm / Final WhatsApp reminder draft.
7. **Find My Lost Money (`/lost-money`)**: Drill down into the exact `₹67,500` high-priority recovery bucket (`₹18,500 + ₹42,000 + ₹7,000`).
8. **Loan Readiness (`/loan-readiness`)**: Toggle the **What-If Simulator** switches to see how resolving the 3 unmatched payments (+7) and overdue receivables (+5) lifts your score from `72` to `84+`.
9. **AI Munim Chat (`/munim`)**: Ask *"Munim ji, mera sabse bada financial problem kya hai?"* to receive a ranked, tool-grounded breakdown.
10. **Credit Pack PDF (`/credit-pack`)**: Click **Download Credit Pack PDF (.pdf)** to download the 2-page lender dossier.
