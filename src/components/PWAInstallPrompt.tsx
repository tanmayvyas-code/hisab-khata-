import React, { useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — Cached shop records active</span>
    </div>
  );
};

export const PWAInstallModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [platformTab, setPlatformTab] = useState<'android' | 'ios' | 'desktop'>(
    isIOS ? 'ios' : 'android'
  );
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!open) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallSuccess(true);
      }
    } else {
      setInstallSuccess(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#00966B] text-xl font-extrabold text-white shadow-xs">
              H
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Install Hisab Kitab App</h3>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Fast mobile access · Voice billing · JPEG/PNG Camera scan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install popup"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
          <div>
            <p className="font-bold text-slate-900">🎤 Voice</p>
            <p className="text-[11px] text-slate-500">Hinglish bills</p>
          </div>
          <div className="border-x border-slate-200">
            <p className="font-bold text-slate-900">📷 Scanner</p>
            <p className="text-[11px] text-slate-500">1-tap GST OCR</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">⚡ Offline</p>
            <p className="text-[11px] text-slate-500">Instant launch</p>
          </div>
        </div>

        {isInstalled || installSuccess ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                {isInstalled
                  ? 'Hisab Kitab is installed on your device!'
                  : 'App installation ready — follow the quick step below if prompted by your browser:'}
              </span>
            </div>
            {!isInstalled && (
              <p className="text-emerald-800 leading-relaxed">
                In mobile Chrome, tap <strong>⋮ Menu → Add to Home screen / Install app</strong>. On
                iPhone Safari, tap <strong>Share → Add to Home Screen</strong>.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99] transition"
          >
            <Download className="h-4 w-4" />
            <span>
              {isInstallable ? 'Install App on Home Screen' : 'Add Hisab Kitab to Home Screen'}
            </span>
          </button>
        )}

        {/* Step-by-step Mobile & Desktop Guide */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {(
              [
                { id: 'android', label: 'Android / Chrome' },
                { id: 'ios', label: 'iPhone / iPad' },
                { id: 'desktop', label: 'Desktop' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlatformTab(tab.id)}
                className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
                  platformTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1.5">
            {platformTab === 'android' && (
              <>
                <p className="font-semibold text-slate-900">Install on Android Phone:</p>
                <p>1. Tap the green <strong>Install App</strong> button above (or browser menu <strong>⋮</strong>).</p>
                <p>2. Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                <p>3. Launch <strong>Hisab Kitab</strong> full-screen from your phone home screen.</p>
              </>
            )}
            {platformTab === 'ios' && (
              <>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <span>Install on iPhone / iPad (Safari):</span>
                  <Share className="h-3.5 w-3.5 text-emerald-600" />
                </p>
                <p>1. Tap the <strong>Share</strong> icon in the bottom Safari bar.</p>
                <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
                <p>3. Tap <strong>Add</strong> in the top-right corner.</p>
              </>
            )}
            {platformTab === 'desktop' && (
              <>
                <p className="font-semibold text-slate-900">Install on Laptop / Shop Counter PC:</p>
                <p>1. Click the <strong>Install Hisab Kitab</strong> icon in your Chrome/Edge address bar.</p>
                <p>2. Or click the green button above to launch in a standalone desktop window.</p>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
        >
          Continue in Browser
        </button>
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC<{
  compact?: boolean;
  onOpenModal: () => void;
}> = ({ compact = false, onOpenModal }) => {
  const { isInstalled } = usePWAInstall();

  if (isInstalled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap ${
        compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
      }`}
    >
      <Smartphone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      <span>Install App</span>
    </button>
  );
};

export const PWAInstallFloatingPopup: React.FC<{
  onOpenModal: () => void;
}> = ({ onOpenModal }) => {
  const { isInstalled } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-16 lg:bottom-5 right-3 left-3 sm:left-auto sm:right-5 z-30 sm:max-w-sm">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00966B] text-base font-extrabold text-white">
            H
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              Install Hisab Kitab Mobile App
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              1-tap Home Screen access · Offline ready
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenModal}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss install banner"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
