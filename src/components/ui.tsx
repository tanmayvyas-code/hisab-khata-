import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert } from 'lucide-react';
import { LOAN_READINESS_DISCLAIMER } from '../i18n/translations';

export const ScoreRing: React.FC<{
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  colorClass?: string;
}> = ({ score, size = 112, strokeWidth = 9, label, sublabel, colorClass }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    colorClass ||
    (clamped >= 75
      ? '#059669' // emerald-600
      : clamped >= 60
        ? '#D97706' // amber-600
        : '#DC2626'); // red-600

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tabular-nums text-2xl font-bold tracking-tight text-slate-900">{clamped}</span>
          <span className="text-[11px] font-medium text-slate-500">/ 100</span>
        </div>
      </div>
      {label && <span className="mt-2 text-sm font-semibold text-slate-900">{label}</span>}
      {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
    </div>
  );
};

export const ConfidenceBar: React.FC<{
  confidence: number;
  label?: string;
  showWarningBelow?: number;
}> = ({ confidence, label, showWarningBelow = 80 }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(confidence)));
  const isLow = clamped < showWarningBelow;
  const isStrong = clamped >= 85;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label || 'Confidence'}</span>
        <span
          className={`tabular-nums font-semibold ${
            isStrong ? 'text-emerald-700' : isLow ? 'text-amber-700' : 'text-slate-700'
          }`}
        >
          {clamped}% {isStrong ? '· Strong' : isLow ? '· Review Needed' : '· Possible'}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-100">
        <div
          className={`h-full transition-all duration-200 ${
            isStrong ? 'bg-emerald-600' : isLow ? 'bg-amber-500' : 'bg-blue-600'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export const StatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const norm = status.toLowerCase();
  if (norm === 'paid' || norm === 'matched' || norm === 'auto_confirmed' || norm === 'user_confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{norm === 'paid' ? 'Paid' : 'Matched'}</span>
      </span>
    );
  }
  if (norm === 'duplicate') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>Possible Duplicate</span>
      </span>
    );
  }
  if (norm === 'overpaid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Overpaid</span>
      </span>
    );
  }
  if (norm === 'partial' || norm === 'short' || norm === 'possible' || norm === 'suggested') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          {norm === 'short'
            ? 'Short Payment'
            : norm === 'partial'
              ? 'Partial Paid'
              : 'Possible Match — Confirm'}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 whitespace-nowrap">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>{norm === 'unpaid' ? 'Unpaid' : 'Unmatched'}</span>
    </span>
  );
};

export const HinglishLoader: React.FC<{ message: string; subMessage?: string }> = ({
  message,
  subMessage,
}) => (
  <div
    role="status"
    aria-live="polite"
    className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center"
  >
    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    <p className="mt-3 text-base font-semibold text-slate-900">{message}</p>
    {subMessage && <p className="mt-1 text-xs text-slate-500">{subMessage}</p>}
  </div>
);

export const EmptyStateCard: React.FC<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
    <p className="text-base font-semibold text-slate-900">{title}</p>
    {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const HisabKitabLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'horizontal' | 'stacked';
  dark?: boolean;
  showTagline?: boolean;
  onClick?: () => void;
}> = ({ size = 'md', variant = 'horizontal', dark = false, showTagline = true, onClick }) => {
  const GraphicEmblem = ({ className }: { className?: string }) => (
    <svg
      viewBox="0 0 260 165"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Hisab Kitab — Bill Se Bank Tak, Saara Hisab Ek Jagah"
    >
      <defs>
        <linearGradient id="hkBookGrad" x1="40" y1="28" x2="118" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D6EFD" />
          <stop offset="100%" stopColor="#054499" />
        </linearGradient>
        <linearGradient id="hkTopArrow" x1="95" y1="18" x2="172" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="45%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="hkBotArrow" x1="168" y1="132" x2="96" y2="122" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="45%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="hkBankPillars" x1="150" y1="68" x2="215" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      {/* Soft ground shadow */}
      <ellipse cx="135" cy="142" rx="86" ry="8" fill="#0F172A" fillOpacity="0.06" />

      {/* Top Green Curved Arrow (Book -> Bank) */}
      <path
        d="M102 24C124 12 149 14 166 29"
        stroke="url(#hkTopArrow)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path d="M174 37L171 19L156 33L174 37Z" fill="#047857" />

      {/* 3 Green Rays above Bank */}
      <path d="M196 36L199 23" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
      <path d="M206 43L216 33" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
      <path d="M212 52L224 49" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />

      {/* Classical BANK Building (Right) */}
      <g>
        {/* Dark blue backdrop behind pillars */}
        <rect x="155" y="72" width="56" height="46" rx="2" fill="url(#hkBankPillars)" />
        {/* Roof Pediment */}
        <path
          d="M144 68L183 41L222 68H144Z"
          fill="#E2E8F0"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M151 66L183 45L215 66H151Z" fill="#F8FAFC" />
        <circle cx="183" cy="53" r="4" fill="#0A366B" />
        {/* BANK Frieze bar */}
        <rect x="148" y="66" width="70" height="11" rx="2" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />
        <text
          x="183"
          y="74.5"
          textAnchor="middle"
          fill="#0A366B"
          fontSize="9.5"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.8"
        >
          BANK
        </text>
        {/* 3 Pillars */}
        <rect x="158" y="77" width="10" height="39" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
        <rect x="178" y="77" width="10" height="39" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
        <rect x="198" y="77" width="10" height="39" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
        {/* Base steps */}
        <rect x="150" y="116" width="66" height="6" rx="2" fill="#E2E8F0" />
        <rect x="146" y="121" width="74" height="6" rx="2.5" fill="#60A5FA" />
      </g>

      {/* Blue Spiral Ledger Book "हिसाब" (Left) */}
      <g>
        {/* Back cover & white pages */}
        <path
          d="M52 38C52 32.5 56.5 28 62 28H106C110 28 113 31 113 35V115C113 119 110 122 106 122H62C56.5 122 52 117.5 52 112V38Z"
          fill="#023E8A"
        />
        <path
          d="M56 36C56 32.5 59 30 63 30H109L114 34H62C59 34 58 36 58 39V118L56 114V36Z"
          fill="#FFFFFF"
        />
        {/* Front blue cover */}
        <rect
          x="59"
          y="34"
          width="58"
          height="88"
          rx="7"
          fill="url(#hkBookGrad)"
          stroke="#38BDF8"
          strokeWidth="1.2"
        />
        {/* Spiral rings on left spine */}
        <path d="M49 50H62" stroke="#082F5E" strokeWidth="5" strokeLinecap="round" />
        <path d="M50 67H63" stroke="#082F5E" strokeWidth="5" strokeLinecap="round" />
        <path d="M51 84H64" stroke="#082F5E" strokeWidth="5" strokeLinecap="round" />
        <path d="M52 101H65" stroke="#082F5E" strokeWidth="5" strokeLinecap="round" />
        {/* Green leaf accent on cover */}
        <path
          d="M96 48C96 42 103 39 109 40C108 46 103 50 96 48Z"
          fill="#4ADE80"
        />
        {/* "हिसाब" text on book cover */}
        <text
          x="88"
          y="69"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="19"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
        >
          हिसाब
        </text>
        {/* Two ledger lines under हिसाब */}
        <line x1="70" y1="81" x2="102" y2="77" stroke="#7DD3FC" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="70" y1="90" x2="96" y2="87" stroke="#7DD3FC" strokeWidth="3.2" strokeLinecap="round" />
      </g>

      {/* Center White Bill / Receipt with ₹ */}
      <g>
        <path
          d="M111 66C111 63.8 112.8 62 115 62H147C149.2 62 151 63.8 151 66V128L146 124L141 128L136 124L131 128L126 124L121 128L116 124L111 128V66Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1.5"
        />
        <text
          x="121"
          y="83"
          fill="#082F5E"
          fontSize="18"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
        >
          ₹
        </text>
        <line x1="134" y1="73" x2="145" y2="73" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
        <line x1="134" y1="80" x2="145" y2="80" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
        <line x1="118" y1="92" x2="145" y2="92" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" />
        <line x1="118" y1="100" x2="145" y2="100" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" />
        <line x1="118" y1="108" x2="138" y2="108" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Bottom Blue-Green Curved Arrow (Bank -> Book) */}
      <path
        d="M164 130C146 145 121 144 103 127"
        stroke="url(#hkBotArrow)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path d="M95 117L98 136L113 123L95 117Z" fill="#0284C7" />
    </svg>
  );

  if (variant === 'stacked') {
    const emblemHeight =
      size === 'xl'
        ? 'h-36 sm:h-44'
        : size === 'lg'
          ? 'h-28 sm:h-36'
          : size === 'sm'
            ? 'h-16'
            : 'h-24';
    const wordmarkSize =
      size === 'xl'
        ? 'text-4xl sm:text-5xl'
        : size === 'lg'
          ? 'text-3xl sm:text-4xl'
          : 'text-2xl sm:text-3xl';
    const subTaglineSize =
      size === 'xl'
        ? 'text-sm sm:text-lg'
        : size === 'lg'
          ? 'text-xs sm:text-base'
          : 'text-xs sm:text-sm';

    return (
      <div
        onClick={onClick}
        className={`inline-flex flex-col items-center text-center select-none ${
          onClick ? 'cursor-pointer group' : ''
        }`}
      >
        <GraphicEmblem
          className={`${emblemHeight} w-auto transition-transform duration-150 ${
            onClick ? 'group-hover:scale-[1.02]' : ''
          }`}
        />
        <div
          className={`-mt-1 ${wordmarkSize} font-black tracking-tight leading-none ${
            dark ? 'text-white' : 'text-[#082F5E]'
          }`}
        >
          <span>हिसाब </span>
          <span className="font-extrabold">Kitab</span>
        </div>
        {showTagline && (
          <p
            className={`mt-2 ${subTaglineSize} font-extrabold uppercase tracking-[0.08em] ${
              dark ? 'text-emerald-300' : 'text-[#0D3B66]'
            }`}
          >
            BILL SE BANK TAK, SAARA HISAB EK JAGAH.
          </p>
        )}
      </div>
    );
  }

  // Horizontal layout for Top Bar / Sidebar
  const iconHeight =
    size === 'lg' ? 'h-14' : size === 'sm' ? 'h-10' : 'h-12';
  const titleSize =
    size === 'lg' ? 'text-xl sm:text-2xl' : size === 'sm' ? 'text-base sm:text-lg' : 'text-lg sm:text-xl';
  const taglineSize =
    size === 'lg'
      ? 'text-xs sm:text-sm font-extrabold'
      : 'text-[10px] sm:text-xs font-extrabold';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 text-left select-none ${
        onClick ? 'cursor-pointer group' : ''
      }`}
    >
      <GraphicEmblem
        className={`${iconHeight} w-auto shrink-0 transition-transform duration-150 ${
          onClick ? 'group-hover:scale-[1.03]' : ''
        }`}
      />
      <div className="flex flex-col justify-center leading-tight">
        <span
          className={`${titleSize} font-black tracking-tight ${
            dark ? 'text-white' : 'text-[#082F5E]'
          }`}
        >
          हिसाब Kitab
        </span>
        {showTagline && (
          <span
            className={`mt-0.5 ${taglineSize} uppercase tracking-wide ${
              dark ? 'text-emerald-300' : 'text-[#0D3B66]'
            }`}
          >
            Bill Se Bank Tak, Saara Hisab Ek Jagah
          </span>
        )}
      </div>
    </div>
  );
};

export const LoanDisclaimerBanner: React.FC = () => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
    <strong className="font-semibold text-slate-800">Disclaimer: </strong>
    {LOAN_READINESS_DISCLAIMER}
  </div>
);
