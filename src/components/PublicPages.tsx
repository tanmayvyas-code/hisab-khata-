import React, { useState } from 'react';
import {
  ArrowRight,
  Lock,
  Smartphone,
  Store,
  User,
} from 'lucide-react';
import heroMsmeImg from '../assets/images/hero_msme_munim_1791498758741.jpg';
import multimodalScanImg from '../assets/images/feature_multimodal_scan_1791498769598.jpg';
import { LOAN_READINESS_DISCLAIMER } from '../i18n/translations';
import { PWAInstallButton } from './PWAInstallPrompt';
import { HisabKitabLogo } from './ui';

interface PublicPageProps {
  onNavigate: (path: string) => void;
  onDemoLogin: () => Promise<void>;
  onAuthSuccess: () => Promise<void>;
  onOpenInstallModal?: () => void;
}

export const HisabKitabBrandMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  return <HisabKitabLogo size={size} showTagline={true} />;
};

export const LandingPage: React.FC<PublicPageProps> = ({
  onNavigate,
  onDemoLogin,
  onOpenInstallModal,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [scanImgError, setScanImgError] = useState(false);
  const [startingDemo, setStartingDemo] = useState(false);

  const handleInstantDemo = async () => {
    setStartingDemo(true);
    try {
      await onDemoLogin();
    } finally {
      setStartingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 sm:pb-0">
      {/* Minimal Mobile-Friendly Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 sm:px-6 backdrop-blur">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="whitespace-nowrap"
        >
          <HisabKitabBrandMark size="sm" />
        </a>

        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <a href="#outcomes" className="hover:text-slate-900 transition-colors">
            Outcomes
          </a>
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
            How It Works
          </a>
          <a href="#multimodal" className="hover:text-slate-900 transition-colors">
            Voice & Vision
          </a>
          <a href="#lost-money" className="hover:text-slate-900 transition-colors">
            Lost Money
          </a>
          <a href="#comparison" className="hover:text-slate-900 transition-colors">
            Compare
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {onOpenInstallModal && <PWAInstallButton compact onOpenModal={onOpenInstallModal} />}
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Login / Signup
          </button>
          <button
            type="button"
            disabled={startingDemo}
            onClick={handleInstantDemo}
            className="rounded-lg bg-[#00966B] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#007F5A] transition-colors whitespace-nowrap"
          >
            {startingDemo ? 'Opening...' : 'Try Demo'}
          </button>
        </div>
      </header>

      {/* Minimal, Mobile-First Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <span>Hisab Kitab for Indian MSMEs</span>
            </div>

            <p className="mt-2 text-2xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-[#082F5E] leading-tight">
              Bill Se Bank Tak, Saara Hisab Ek Jagah
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl lg:leading-[1.15]">
              Record Less. Recover Money. Cross-Check Statement &amp; Bill.
            </h1>

            <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Voice se bill banao. Camera se JPEG/PNG parchi scan karo. Bank statement aur bill ko ek click mein Cross-Check karo, aur pending udhaar time par wapas pao.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00966B] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#007F5A] transition-colors"
              >
                <span>Apni Dukan Ka Account Banayein</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                disabled={startingDemo}
                onClick={handleInstantDemo}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <span>{startingDemo ? 'Loading Demo...' : 'Launch Instant Demo Shop'}</span>
              </button>

              {onOpenInstallModal && (
                <button
                  type="button"
                  onClick={onOpenInstallModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  <span>Install App</span>
                </button>
              )}
            </div>

            {/* Minimal 3-Metric Proof Strip */}
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5">
              <div>
                <p className="tabular-nums text-lg sm:text-2xl font-bold text-slate-900">₹67,500</p>
                <p className="text-[11px] text-slate-500">Lost money found</p>
              </div>
              <div>
                <p className="tabular-nums text-lg sm:text-2xl font-bold text-slate-900">78/100</p>
                <p className="text-[11px] text-slate-500">Health score</p>
              </div>
              <div>
                <p className="tabular-nums text-lg sm:text-2xl font-bold text-slate-900">72/100</p>
                <p className="text-[11px] text-slate-500">Loan readiness</p>
              </div>
            </div>
          </div>

          {/* Compact Live Shop Card */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              {!heroImgError ? (
                <div className="relative aspect-video w-full bg-slate-900">
                  <img
                    src={heroMsmeImg}
                    alt="Indian shop owner using Hisab Kitab on tablet at shop counter"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                    <p className="text-[11px] font-semibold text-emerald-300">
                      Agarwal Kirana & Hardware · Jaipur
                    </p>
                    <p className="mt-0.5 text-xs sm:text-sm font-semibold leading-snug">
                      “Aaj sales ₹18,500 rahi. Rahul ka ₹42,000 pending hai. Ek duplicate payment ₹18,500 mila.”
                    </p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full bg-slate-900 p-5 text-white flex flex-col justify-end">
                  <p className="text-sm font-semibold">Hisab Kitab Live Shop Preview</p>
                </div>
              )}

              <div className="divide-y divide-slate-100 p-4 text-xs">
                <div className="pb-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600">🚨 Duplicate bill paid twice (Gupta Traders)</span>
                  <span className="tabular-nums font-bold text-red-700 shrink-0">₹18,500</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600">⏳ Overdue 45d (Rahul Sharma)</span>
                  <span className="tabular-nums font-bold text-amber-700 shrink-0">₹42,000</span>
                </div>
                <div className="pt-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600">📈 Fix 3 unmatched bank entries</span>
                  <span className="tabular-nums font-bold text-emerald-700 shrink-0">72 → 79</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Core Outcomes: Minimal Cards */}
      <section id="outcomes" className="border-y border-slate-200 bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Three Outcomes on Every Screen
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
              <p className="text-[11px] font-bold text-emerald-700">01 · SAVE MONEY</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                Stop Duplicate Bills & Overpayments
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Flags when a vendor is paid twice via UPI/NEFT, catches ₹7,000 excess payouts, and
                compares supplier item rates.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
              <p className="text-[11px] font-bold text-amber-700">02 · GET MONEY</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                Collect Overdue Udhaar Faster
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Ranks who to collect from first and generates Polite, Firm, or Final WhatsApp
                reminders in Hinglish, Hindi, or English.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
              <p className="text-[11px] font-bold text-blue-700">03 · GET READY</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">
                Explainable Loan Readiness & PDF
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Shows why your readiness score is 72/100, simulates fixes, and downloads a 2-page
                Lender Credit Pack PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compact 6-Step Flow + Multimodal Preview */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center" id="multimodal">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-bold text-emerald-700">VOICE + CAMERA WORKFLOW</p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Speak or Snap a Bill (JPEG / PNG / Camera) — Hisab Kitab Handles the Rest
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { step: '1. Capture', desc: 'Voice, JPEG/PNG, Camera' },
                { step: '2. Understand', desc: 'OCR + Hinglish Intent' },
                { step: '3. Reconcile', desc: '8-Signal Bank Match' },
                { step: '4. Alert', desc: 'Duplicate & Rate Flags' },
                { step: '5. Recover', desc: 'Smart Collection Queue' },
                { step: '6. Advise', desc: 'Hisab AI & Credit PDF' },
              ].map((s) => (
                <div key={s.step} className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <p className="text-xs font-bold text-emerald-700">{s.step}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <p className="font-semibold text-slate-500">Hinglish Voice Example:</p>
              <p className="mt-1 font-mono text-slate-900">
                “Ramesh ko 5 kilo rice 60 rupaye kilo aur 2 kilo sugar 45 rupaye kilo”
              </p>
              <p className="mt-1 font-semibold text-emerald-700">
                → Auto-calculates ₹390 draft invoice with mandatory confirmation.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {!scanImgError ? (
                <img
                  src={multimodalScanImg}
                  alt="Indian wholesale bill ready for camera scan"
                  referrerPolicy="no-referrer"
                  onError={() => setScanImgError(true)}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] w-full bg-slate-100 p-6 flex items-center justify-center text-xs text-slate-500">
                  Camera Bill Scanner
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Lost Money & Comparison Summary */}
      <section id="lost-money" className="border-t border-slate-200 bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
              <p className="text-xs font-bold text-red-700">FIND MY LOST MONEY</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                ₹67,500 Recoverable in Demo Shop
              </p>
              <p className="mt-1 text-xs text-slate-600">
                ₹18,500 Duplicate Payment · ₹42,000 Overdue &gt;40d · ₹7,000 Supplier Overpayment
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5">
              <p className="text-xs font-bold text-blue-700">LOAN READINESS INDICATOR</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                Score 72/100 → Simulate Reaching 87/100
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{LOAN_READINESS_DISCLAIMER}</p>
            </div>
          </div>

          <div id="comparison" className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-3.5 py-3">Capability</th>
                  <th className="px-3.5 py-3">Traditional Accounting / Khata</th>
                  <th className="px-3.5 py-3 text-emerald-800">Hisab Kitab Copilot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                <tr>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900">Entry</td>
                  <td className="px-3.5 py-2.5">Manual typing in forms</td>
                  <td className="px-3.5 py-2.5 font-semibold text-emerald-800">
                    Hinglish Voice + JPEG/PNG Bill Camera Scan
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900">Money Recovery</td>
                  <td className="px-3.5 py-2.5">Manual ledger audit</td>
                  <td className="px-3.5 py-2.5 font-semibold text-emerald-800">
                    Auto duplicate, overpayment & rate-gap alerts
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900">Loan Readiness</td>
                  <td className="px-3.5 py-2.5">Static reports</td>
                  <td className="px-3.5 py-2.5 font-semibold text-emerald-800">
                    72/100 Explainable Score + 1-Click Credit Pack PDF
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <p className="font-semibold text-slate-800">
            Hisab Kitab — Bill se Bank tak, Saara Hisab Ek Jagah
          </p>
          <div className="flex items-center gap-5">
            {onOpenInstallModal && (
              <button
                type="button"
                onClick={onOpenInstallModal}
                className="font-semibold text-emerald-700 hover:underline"
              >
                Install App
              </button>
            )}
            <button type="button" onClick={handleInstantDemo} className="hover:text-slate-900">
              Instant Demo
            </button>
            <button type="button" onClick={() => onNavigate('/login')} className="hover:text-slate-900">
              Login
            </button>
            <button type="button" onClick={() => onNavigate('/signup')} className="hover:text-slate-900">
              Sign Up
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const AuthPages: React.FC<{
  mode: 'login' | 'signup' | 'verify-otp';
  onNavigate: (path: string) => void;
  onDemoLogin: () => Promise<void>;
  onAuthSuccess: () => Promise<void>;
}> = ({ mode, onNavigate, onDemoLogin, onAuthSuccess }) => {
  // Default to the exact 4-field "Apni Dukan Ka Account Banayein" card shown in the user's reference image
  const [viewMode, setViewMode] = useState<'account' | 'existing-login' | 'otp'>(
    mode === 'verify-otp' ? 'otp' : 'account'
  );
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (viewMode === 'otp') {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: mobile || '9829012345', otp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'OTP verification failed');
        await onAuthSuccess();
        return;
      }

      if (viewMode === 'existing-login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: mobile || 'rajesh@agarwalstore.in',
            password: password || 'demo1234',
          }),
        });
        if (!res.ok) {
          // If custom credentials were entered, log into demo session seamlessly
          await fetch('/api/auth/demo-login', { method: 'POST' });
        }
        await onAuthSuccess();
        return;
      }

      // Default 4-field "Apni Dukan Ka Account Banayein" flow
      const cleanShop = shopName.trim() || 'Balaji Traders';
      const cleanOwner = ownerName.trim() || 'Ramesh Kumar';
      const cleanMobile = mobile.trim() || '9876543210';
      const cleanPass = password.trim() || 'demo1234';

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanOwner,
          email: `${cleanMobile}@hisabkitab.in`,
          mobile: cleanMobile,
          password: cleanPass,
          shopName: cleanShop,
          businessType: 'kirana',
          loadDemoData: false,
        }),
      });

      if (!res.ok) {
        // If mobile already exists, log in and update shop name & owner name with clean state
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanMobile, password: cleanPass }),
        });
        await fetch('/api/shop/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopName: cleanShop,
            ownerName: cleanOwner,
            mobile: cleanMobile,
          }),
        });
      }

      await onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-8 px-4 sm:px-6">
      {/* Top Centered Official हिसाब Kitab Logo + Large Tagline */}
      <div className="flex flex-col items-center text-center">
        <HisabKitabLogo
          size="lg"
          variant="stacked"
          showTagline={true}
          onClick={() => onNavigate('/')}
        />
      </div>

      {/* Main Heading & Subtitle */}
      <h1 className="mt-4 text-center text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900">
        {viewMode === 'existing-login'
          ? 'Apni Dukan Mein Login Karein'
          : viewMode === 'otp'
            ? 'Mobile OTP Verify Karein'
            : 'Apni Dukan Ka Account Banayein'}
      </h1>
      <p className="mt-1.5 text-center text-xs sm:text-sm text-slate-500">
        1 minute mein shuru karein — bilkul saaf khata (0 demo data).
      </p>

      {/* Main Rounded Card matching reference image */}
      <div className="mt-7 w-full max-w-[440px] rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {viewMode === 'account' && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  SHOP KA NAAM
                </label>
                <div className="relative mt-2">
                  <Store className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Balaji Traders"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00966B] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  AAPKA NAAM (OWNER)
                </label>
                <div className="relative mt-2">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00966B] focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              MOBILE NUMBER
            </label>
            <div className="relative mt-2">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="9876543210"
                className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-[#00966B] focus:outline-none"
              />
            </div>
          </div>

          {viewMode !== 'otp' ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                PASSWORD
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00966B] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                6-DIGIT OTP (DEMO: 123456)
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm font-bold tracking-widest tabular-nums text-slate-900 focus:border-[#00966B] focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00966B] py-3.5 px-5 text-sm font-bold text-white shadow-xs hover:bg-[#007F5A] transition-colors"
          >
            <span>
              {loading
                ? 'Shuru ho raha hai...'
                : viewMode === 'existing-login'
                  ? 'Dukan Login Karein'
                  : viewMode === 'otp'
                    ? 'OTP Verify Karein'
                    : 'Account Banayein'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Secondary Actions & Quick Demo Link */}
        <div className="mt-5 border-t border-slate-100 pt-4 space-y-2.5 text-center">
          <button
            type="button"
            onClick={onDemoLogin}
            className="w-full rounded-xl border border-emerald-600/30 bg-emerald-50/70 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            1-Click Instant Demo Dukan Dekhein →
          </button>

          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            {viewMode === 'account' ? (
              <button
                type="button"
                onClick={() => setViewMode('existing-login')}
                className="font-semibold text-[#00966B] hover:underline"
              >
                Pehle se account hai? Login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('account')}
                className="font-semibold text-[#00966B] hover:underline"
              >
                Nayi Dukan? Account Banayein
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'otp' ? 'account' : 'otp')}
              className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              {viewMode === 'otp' ? 'Back to Form' : 'OTP Login (123456)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
