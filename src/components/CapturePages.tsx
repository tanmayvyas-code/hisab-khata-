import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Image as ImageIcon,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Customer,
  Language,
  ParsedBillScan,
  ParsedVoiceCommand,
  Product,
  Supplier,
} from '../types/domain';
import { ERROR_MESSAGES, formatINR, LOADING_MESSAGES } from '../i18n/translations';
import { ConfidenceBar, HinglishLoader } from './ui';

export const VoiceBillingPage: React.FC<{
  language: Language;
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ language, onRefreshState, onNavigate }) => {
  const [transcript, setTranscript] = useState(
    'Ramesh ko 5 kilo rice 60 rupaye kilo aur 2 kilo sugar 45 rupaye kilo'
  );
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedVoiceCommand | null>(null);
  const [editablePartyName, setEditablePartyName] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  const [editableAmount, setEditableAmount] = useState(0);
  const [editableItems, setEditableItems] = useState<ParsedVoiceCommand['items']>([]);
  const [committedBanner, setCommittedBanner] = useState('');
  const [simulateAmbiguousRamesh, setSimulateAmbiguousRamesh] = useState(false);

  const exampleChips = [
    {
      label: 'Aalu 100 kg (Ramesh ₹2,500)',
      text: 'Aalu 100 kilo Ramesh ko Diye',
    },
    {
      label: 'Itemized Bill (Ramesh ₹390)',
      text: 'Ramesh ko 5 kilo rice 60 rupaye kilo aur 2 kilo sugar 45 rupaye kilo',
    },
    {
      label: 'Credit Sale (Udhaar ₹5,000)',
      text: 'Ramesh ne ₹5,000 ka maal udhaar liya',
    },
    {
      label: 'Payment Received (Rahul ₹2,000)',
      text: 'Rahul ne ₹2,000 de diye',
    },
    {
      label: 'Cash Sale (₹15,000)',
      text: 'Aaj cash sale ₹15,000 hui',
    },
    {
      label: 'Supplier Payment (Gupta ₹18,500)',
      text: 'Gupta Traders ko ₹18,500 payment ki',
    },
  ];

  const handleMicToggle = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsListening(false);
      handleParse(transcript);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    setIsListening(true);
    let latestSpoken = '';
    recognition.onresult = (event: any) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      if (combined.trim()) {
        latestSpoken = combined.trim();
        setTranscript(latestSpoken);
      }
      if (event.results?.[0]?.isFinal && latestSpoken) {
        setIsListening(false);
        handleParse(latestSpoken);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      setIsListening(false);
      if (latestSpoken) {
        handleParse(latestSpoken);
      }
    };
    recognition.start();
  };

  const handleParse = async (textToParse = transcript) => {
    setLoading(true);
    setCommittedBanner('');
    try {
      const res = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToParse }),
      });
      const data: ParsedVoiceCommand = await res.json();
      if (simulateAmbiguousRamesh && (data.partyName || '').toLowerCase().includes('ramesh')) {
        data.isAmbiguousParty = true;
        data.matchedParties = [
          {
            id: 'cust-ramesh',
            name: 'Ramesh Kumar (Malviya Nagar)',
            type: 'customer',
            mobile: '9829077889',
          },
          {
            id: 'cust-ramesh-2',
            name: 'Ramesh General Store (Mansarovar)',
            type: 'customer',
            mobile: '9829055110',
          },
        ];
        data.explanation =
          'Kaun sa Ramesh? Do customers match ho rahe hain — kripya select karein.';
      }
      setParsed(data);
      setEditablePartyName(data.partyName || 'Walk-in Customer');
      setSelectedPartyId(data.matchedParties[0]?.id);
      setEditableAmount(data.totalAmount);
      setEditableItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      if (parsed.intent === 'payment_received' || parsed.intent === 'supplier_payment') {
        await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            direction: parsed.intent === 'supplier_payment' ? 'out' : 'in',
            partyType: parsed.intent === 'supplier_payment' ? 'supplier' : 'customer',
            partyId: selectedPartyId,
            partyName: editablePartyName,
            amount: editableAmount,
            method: parsed.paymentMethod || 'UPI',
            source: 'voice',
            notes: `Voice entry: "${parsed.rawTranscript}"`,
          }),
        });
        setCommittedBanner(
          `✓ Confirmed! ${editablePartyName} ka ${formatINR(editableAmount)} payment record ho gaya.`
        );
      } else {
        const itemsToSave =
          editableItems.length > 0
            ? editableItems
            : [
                {
                  name: 'Voice Billed Items',
                  quantity: 1,
                  unit: 'pcs',
                  unitPrice: editableAmount,
                  lineTotal: editableAmount,
                },
              ];
        await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sale',
            customerId: selectedPartyId,
            customerName: editablePartyName,
            total: editableAmount,
            paidAmount: parsed.intent === 'cash_sale' ? editableAmount : 0,
            source: 'voice',
            items: itemsToSave,
            notes: `Created via Voice Billing: "${parsed.rawTranscript}"`,
          }),
        });
        setCommittedBanner(
          `✓ Confirmed! ${editablePartyName} ke liye ${formatINR(editableAmount)} ka bill save ho gaya.`
        );
      }
      setParsed(null);
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  const updateItemRow = (
    idx: number,
    field: 'name' | 'quantity' | 'unit' | 'unitPrice' | 'lineTotal',
    value: string
  ) => {
    const next = [...editableItems];
    const row = { ...next[idx] };
    if (field === 'name') {
      row.name = value;
    } else if (field === 'unit') {
      row.unit = value;
    } else if (field === 'quantity') {
      row.quantity = Math.max(0.01, Number(value) || 0);
      row.lineTotal = Math.round(row.quantity * row.unitPrice);
    } else if (field === 'unitPrice') {
      row.unitPrice = Math.max(0, Number(value) || 0);
      row.lineTotal = Math.round((row.quantity || 1) * row.unitPrice);
    } else if (field === 'lineTotal') {
      row.lineTotal = Math.max(0, Number(value) || 0);
      row.unitPrice = row.quantity > 0 ? Math.round((row.lineTotal / row.quantity) * 100) / 100 : row.lineTotal;
    }
    next[idx] = row;
    setEditableItems(next);
    setEditableAmount(next.reduce((s, r) => s + r.lineTotal, 0));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Voice Billing & Hinglish Entry</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Bolein ya type karein — bina aapki manzoori (Confirm) ke koi bhi bill ya payment save
            nahi hoga.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={simulateAmbiguousRamesh}
            onChange={(e) => setSimulateAmbiguousRamesh(e.target.checked)}
            className="rounded border-slate-300 text-emerald-600"
          />
          <span>Test “Kaun sa Ramesh?” disambiguation</span>
        </label>
      </div>

      {committedBanner && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <span>{committedBanner}</span>
          <button
            type="button"
            onClick={() => onNavigate('/invoices')}
            className="text-xs font-bold text-emerald-800 underline"
          >
            View Invoices →
          </button>
        </div>
      )}

      {/* Voice Input Console */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5">
          <button
            type="button"
            onClick={handleMicToggle}
            aria-label="Start or stop voice input"
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-colors ${
              isListening
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
          </button>

          <div className="w-full flex-1">
            <label className="block text-xs font-semibold text-slate-700">
              Spoken or Typed Hinglish / Hindi / English Command
            </label>
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. Ramesh ko 5 kilo rice 60 rupaye kilo aur 2 kilo sugar 45 rupaye kilo"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {exampleChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setTranscript(chip.text);
                    handleParse(chip.text);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Supports Web Speech API (hi-IN / en-IN) + Hisab Kitab Hinglish parser
              </span>
              <button
                type="button"
                onClick={() => handleParse(transcript)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Parse Command
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <HinglishLoader message={LOADING_MESSAGES[language].voice} />}

      {/* Mandatory Confirmation Card */}
      {parsed && !loading && (
        <div className="rounded-xl border-2 border-emerald-600 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                CONFIRMATION REQUIRED BEFORE SAVING
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {parsed.intent === 'create_bill' || parsed.intent === 'credit_sale'
                  ? 'Create this bill?'
                  : 'Confirm this transaction entry?'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">{parsed.explanation}</p>
            </div>
            <div className="w-44">
              <ConfidenceBar confidence={parsed.confidence} label="Voice Parse Confidence" />
            </div>
          </div>

          {parsed.isAmbiguousParty && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-900">
                ⚠️ Kaun sa {parsed.partyName}? Multiple matching customers found:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {parsed.matchedParties.map((mp) => (
                  <button
                    key={mp.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartyId(mp.id);
                      setEditablePartyName(mp.name);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedPartyId === mp.id
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-amber-300 bg-white text-slate-800'
                    }`}
                  >
                    {mp.name} ({mp.mobile})
                  </button>
                ))}
              </div>
            </div>
          )}

          {parsed.isNewParty && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
              New customer <strong>“{editablePartyName}”</strong> will be created only after you
              click Confirm.
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Customer / Supplier Name (Editable)
              </label>
              <input
                type="text"
                value={editablePartyName}
                onChange={(e) => setEditablePartyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Total Amount (₹)</label>
              <input
                type="number"
                value={editableAmount}
                onChange={(e) => setEditableAmount(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold tabular-nums"
              />
            </div>
          </div>

          {editableItems.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Extracted Line Items (Editable before confirming)
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2">Rate (₹)</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {editableItems.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => updateItemRow(idx, 'name', e.target.value)}
                            className="w-full rounded border border-slate-200 px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateItemRow(idx, 'quantity', e.target.value)}
                            className="w-20 rounded border border-slate-200 px-2 py-1 tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2">{it.unit}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={it.unitPrice}
                            onChange={(e) => updateItemRow(idx, 'unitPrice', e.target.value)}
                            className="w-24 rounded border border-slate-200 px-2 py-1 tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {formatINR(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
              <span>Confirm & Save to Books</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface UploadedPhotoMeta {
  dataUrl: string;
  base64Data: string;
  fileName: string;
  format: 'JPEG' | 'PNG';
  mimeType: 'image/jpeg' | 'image/png';
  source: 'upload' | 'camera';
}

export const BillScannerPage: React.FC<{
  language: Language;
  customers: Customer[];
  suppliers: Supplier[];
  onRefreshState: () => Promise<void>;
  onNavigate: (path: string) => void;
}> = ({ language, onRefreshState, onNavigate }) => {
  const [selectedPreset, setSelectedPreset] = useState<
    'gupta_18500' | 'ramesh_kirana' | 'handwritten_low_conf'
  >('gupta_18500');
  const [multimodalVoiceNote, setMultimodalVoiceNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanResult, setScanResult] = useState<ParsedBillScan | null>(null);
  const [editPartyName, setEditPartyName] = useState('');
  const [editPartyType, setEditPartyType] = useState<'customer' | 'supplier'>('customer');
  const [editInvoiceType, setEditInvoiceType] = useState<'sale' | 'purchase'>('sale');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editInvNum, setEditInvNum] = useState('');
  const [editTotal, setEditTotal] = useState(0);
  const [editItems, setEditItems] = useState<ParsedBillScan['items']>([]);
  const [savedNotice, setSavedNotice] = useState('');

  // Photo Upload (JPEG/PNG) & Live Camera Capture state
  const [photoMeta, setPhotoMeta] = useState<UploadedPhotoMeta | null>(null);
  const [captureFormat, setCaptureFormat] = useState<'JPEG' | 'PNG'>('JPEG');
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const runExtraction = async (
    preset = selectedPreset,
    voiceText = multimodalVoiceNote,
    customFileName?: string,
    imageBase64?: string,
    mimeType?: string,
    ignoreUploadedPhoto = false
  ) => {
    setLoading(true);
    setErrorMsg('');
    setSavedNotice('');

    const effectiveBase64 = ignoreUploadedPhoto ? undefined : (imageBase64 ?? photoMeta?.base64Data);
    const effectiveMime = ignoreUploadedPhoto ? undefined : (mimeType ?? photoMeta?.mimeType);
    const effectiveFileName = ignoreUploadedPhoto ? customFileName : (customFileName ?? photoMeta?.fileName);

    try {
      const res = await fetch('/api/scan/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset,
          voiceTranscript: voiceText,
          fileName: effectiveFileName,
          imageBase64: effectiveBase64,
          mimeType: effectiveMime,
        }),
      });
      const data: ParsedBillScan & { error?: string } = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || ERROR_MESSAGES[language].ocrFailed);
        setScanResult(null);
        return;
      }
      setScanResult(data);
      setEditPartyName(data.partyName || 'Scanned Party');
      setEditPartyType(data.partyType === 'supplier' ? 'supplier' : 'customer');
      setEditInvoiceType(data.invoiceType === 'purchase' ? 'purchase' : 'sale');
      setEditPaymentStatus(
        data.paymentStatus === 'paid' || data.voiceInstruction?.action === 'mark_paid'
          ? 'paid'
          : 'unpaid'
      );
      setEditIssueDate(data.issueDate || new Date().toISOString().slice(0, 10));
      setEditInvNum(data.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`);
      setEditTotal(Number(data.total) || 0);
      setEditItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setErrorMsg(ERROR_MESSAGES[language].ocrFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleJpegPngFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'upload' | 'camera' = 'upload'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPng = file.type === 'image/png' || lowerName.endsWith('.png');
    const isImage =
      file.type.startsWith('image/') ||
      ['.jpg', '.jpeg', '.png', '.webp', '.heic'].some((ext) => lowerName.endsWith(ext));

    if (!isImage) {
      setErrorMsg('Kripya JPEG (.jpg, .jpeg) ya PNG (.png) format ki bill photo upload karein.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const rawBase64 = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : '';
      const format: 'JPEG' | 'PNG' = isPng ? 'PNG' : 'JPEG';
      const mimeType: 'image/jpeg' | 'image/png' = isPng ? 'image/png' : 'image/jpeg';

      // Compress large camera photos to max 1600px so Gemini Vision OCR runs in ~3 seconds
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let w = img.width || 800;
          let h = img.height || 600;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressedDataUrl = canvas.toDataURL(mimeType, 0.88);
            const compressedBase64 = compressedDataUrl.includes(',')
              ? compressedDataUrl.split(',')[1]
              : rawBase64;
            const meta: UploadedPhotoMeta = {
              dataUrl: compressedDataUrl,
              base64Data: compressedBase64,
              fileName: file.name,
              format,
              mimeType,
              source,
            };
            setPhotoMeta(meta);
            runExtraction(
              selectedPreset,
              multimodalVoiceNote,
              file.name,
              compressedBase64,
              mimeType,
              false
            );
            return;
          }
        } catch {
          // Fallback to raw DataURL below
        }
        const meta: UploadedPhotoMeta = {
          dataUrl: rawDataUrl,
          base64Data: rawBase64,
          fileName: file.name,
          format,
          mimeType,
          source,
        };
        setPhotoMeta(meta);
        runExtraction(selectedPreset, multimodalVoiceNote, file.name, rawBase64, mimeType, false);
      };
      img.onerror = () => {
        const meta: UploadedPhotoMeta = {
          dataUrl: rawDataUrl,
          base64Data: rawBase64,
          fileName: file.name,
          format,
          mimeType,
          source,
        };
        setPhotoMeta(meta);
        runExtraction(selectedPreset, multimodalVoiceNote, file.name, rawBase64, mimeType, false);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenLiveCamera = async () => {
    setErrorMsg('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(
        'Live camera viewfinder browser mein supported nahi hai — "Phone Camera Snap" ya "Upload JPEG / PNG" button use karein.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setErrorMsg(
        'Camera permission allow nahi hui. Aap "Phone Camera Snap" ya "Upload JPEG / PNG" button se photo le sakte hain.'
      );
    }
  };

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const mimeType: 'image/jpeg' | 'image/png' =
      captureFormat === 'PNG' ? 'image/png' : 'image/jpeg';
    const ext = captureFormat === 'PNG' ? 'png' : 'jpg';
    const dataUrl = canvas.toDataURL(mimeType, 0.9);
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    const fileName = `hisab_kitab_capture_${Date.now()}.${ext}`;

    setPhotoMeta({
      dataUrl,
      base64Data,
      fileName,
      format: captureFormat,
      mimeType,
      source: 'camera',
    });

    stopCameraStream();
    runExtraction(selectedPreset, multimodalVoiceNote, fileName, base64Data, mimeType, false);
  };

  const updateScannedItemRow = (
    idx: number,
    field: 'name' | 'quantity' | 'unit' | 'unitPrice' | 'lineTotal',
    value: string
  ) => {
    const next = [...editItems];
    const row = { ...next[idx] };
    if (field === 'name') {
      row.name = value;
    } else if (field === 'unit') {
      row.unit = value;
    } else if (field === 'quantity') {
      row.quantity = Math.max(0.01, Number(value) || 0);
      row.lineTotal = Math.round(row.quantity * row.unitPrice);
    } else if (field === 'unitPrice') {
      row.unitPrice = Math.max(0, Number(value) || 0);
      row.lineTotal = Math.round((row.quantity || 1) * row.unitPrice);
    } else if (field === 'lineTotal') {
      row.lineTotal = Math.max(0, Number(value) || 0);
      row.unitPrice = row.quantity > 0 ? Math.round((row.lineTotal / row.quantity) * 100) / 100 : row.lineTotal;
    }
    next[idx] = row;
    setEditItems(next);
    setEditTotal(next.reduce((s, r) => s + r.lineTotal, 0));
  };

  const addScannedItemRow = () => {
    const next = [
      ...editItems,
      {
        name: 'New Bill Item',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        discount: 0,
        gstRate: 0,
        lineTotal: 0,
        confidence: 98,
      },
    ];
    setEditItems(next);
  };

  const removeScannedItemRow = (idx: number) => {
    const next = editItems.filter((_, i) => i !== idx);
    setEditItems(next);
    setEditTotal(next.reduce((s, r) => s + r.lineTotal, 0));
  };

  const handleConfirmScannedBill = async () => {
    if (!scanResult) return;
    setLoading(true);
    try {
      const itemsPayload =
        editItems.length > 0
          ? editItems
          : [
              {
                name: 'Scanned Bill Item',
                quantity: 1,
                unit: 'pcs',
                unitPrice: editTotal,
                discount: 0,
                gstRate: 0,
                lineTotal: editTotal,
                confidence: 95,
              },
            ];

      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editInvoiceType,
          invoiceNumber: editInvNum,
          billNumber: editInvNum,
          customerName: editPartyType === 'customer' ? editPartyName : undefined,
          supplierName: editPartyType === 'supplier' ? editPartyName : undefined,
          issueDate: editIssueDate || scanResult.issueDate,
          dueDate: scanResult.dueDate || editIssueDate,
          discount: scanResult.discount,
          gstAmount: scanResult.gstAmount,
          total: editTotal,
          paidAmount: editPaymentStatus === 'paid' ? editTotal : 0,
          source: 'scan',
          ocrConfidence: scanResult.overallConfidence,
          items: itemsPayload,
          notes: scanResult.voiceInstruction
            ? `Multimodal Scan + Voice: "${scanResult.voiceInstruction.rawText}"`
            : 'Extracted via Hisab Kitab Bill Scanner',
        }),
      });
      setSavedNotice(
        `✓ Bill ${editInvNum} (${editPartyName} · ${formatINR(editTotal)}) confirmed and saved to ${
          editPartyType === 'customer' ? 'Customer Khata & Invoices' : 'Supplier Bills & Expenses'
        }!`
      );
      setScanResult(null);
      await onRefreshState();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bill Scanner (JPEG / PNG Upload & Camera Capture)
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Koi bhi printed bill, fee receipt, ya handwritten parchi upload karein — Hisab Kitab AI turant extract karega.
          </p>
        </div>
      </div>

      {savedNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <span>{savedNotice}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/invoices')}
              className="rounded-lg bg-white border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              View in Invoices →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/khata')}
              className="rounded-lg bg-white border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              View Customer Khata →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/bank-statements')}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Next: Upload Bank Statement →
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Main Scanner Controls & Preview Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          {/* Primary Photo Upload (JPEG, PNG) & Camera Capture Cards */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                1. UPLOAD PHOTO (JPEG / PNG) OR CAPTURE FROM CAMERA
              </p>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px]">
                {(['JPEG', 'PNG'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setCaptureFormat(fmt)}
                    className={`rounded-md px-2 py-0.5 font-bold transition-colors ${
                      captureFormat === fmt
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Option A: Upload JPEG or PNG file */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-emerald-600/40 bg-emerald-50/50 p-4 text-center hover:bg-emerald-50 transition-colors">
                <Upload className="h-6 w-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Upload Bill Photo</span>
                <span className="text-[11px] text-slate-500">JPEG, PNG, WEBP</span>
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => handleJpegPngFileUpload(e, 'upload')}
                  className="hidden"
                />
              </label>

              {/* Option B: Live In-App Camera Viewfinder */}
              <button
                type="button"
                onClick={cameraOpen ? stopCameraStream : handleOpenLiveCamera}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-center hover:border-emerald-600 transition-colors"
              >
                <Camera className="h-6 w-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  {cameraOpen ? 'Close Live Camera' : 'Live Camera Capture'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Capture as {captureFormat} (.{captureFormat.toLowerCase()})
                </span>
              </button>

              {/* Option C: Native Mobile Camera Capture (JPEG / PNG) */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-center hover:border-emerald-600 transition-colors">
                <ImageIcon className="h-6 w-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Phone Camera Snap</span>
                <span className="text-[11px] text-slate-500">Direct Camera Capture</span>
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png"
                  capture="environment"
                  onChange={(e) => handleJpegPngFileUpload(e, 'camera')}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Live Camera Viewfinder Modal/Box */}
          {cameraOpen && (
            <div className="rounded-xl border-2 border-emerald-600 bg-slate-950 p-4 text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">
                  📷 LIVE CAMERA VIEWFINDER ({captureFormat} FORMAT)
                </span>
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <div className="overflow-hidden rounded-lg bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={handleCaptureCameraFrame}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                <Camera className="h-4 w-4" />
                <span>Capture Bill Photo ({captureFormat})</span>
              </button>
            </div>
          )}

          {/* Bundled Sample Bills for Instant Demo Testing */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. OR TEST WITH BUNDLED SAMPLE BILLS
            </p>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedPreset('gupta_18500');
                  setPhotoMeta(null);
                  runExtraction('gupta_18500', multimodalVoiceNote, undefined, undefined, undefined, true);
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  !photoMeta && selectedPreset === 'gupta_18500'
                    ? 'border-emerald-600 bg-emerald-50/70'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">Gupta Traders Bill</p>
                <p className="mt-0.5 text-xs tabular-nums font-semibold text-emerald-700">
                  ₹18,500 · Hero Demo
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPreset('ramesh_kirana');
                  setPhotoMeta(null);
                  runExtraction('ramesh_kirana', multimodalVoiceNote, undefined, undefined, undefined, true);
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  !photoMeta && selectedPreset === 'ramesh_kirana'
                    ? 'border-emerald-600 bg-emerald-50/70'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">Ramesh Kirana Bill</p>
                <p className="mt-0.5 text-xs tabular-nums font-semibold text-slate-700">
                  ₹6,300 · GST Sale
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPreset('handwritten_low_conf');
                  setPhotoMeta(null);
                  runExtraction('handwritten_low_conf', multimodalVoiceNote, undefined, undefined, undefined, true);
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  !photoMeta && selectedPreset === 'handwritten_low_conf'
                    ? 'border-amber-600 bg-amber-50/70'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">Handwritten Bill</p>
                <p className="mt-0.5 text-xs tabular-nums font-semibold text-amber-700">
                  ₹4,000 · Low Conf
                </p>
              </button>
            </div>
          </div>

          {/* Multimodal Voice Instruction Input */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-xs font-bold text-slate-800">
              3. ATTACH HINGLISH VOICE / TEXT INSTRUCTION (OPTIONAL)
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={multimodalVoiceNote}
                onChange={(e) => setMultimodalVoiceNote(e.target.value)}
                placeholder='e.g. "Isko Ramesh ke account mein add kar do"'
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const note = 'Isko Ramesh ke account mein add kar do';
                  setMultimodalVoiceNote(note);
                  runExtraction(selectedPreset, note);
                }}
                className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
              >
                Try: “Isko Ramesh ke account mein add kar do”
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() =>
                runExtraction(selectedPreset, multimodalVoiceNote, 'blurry_corrupt.jpg', undefined, undefined, true)
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Test Unclear Photo Error
            </button>

            <button
              type="button"
              onClick={() => runExtraction(selectedPreset, multimodalVoiceNote)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00966B] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#007F5A] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {photoMeta
                  ? `Analyze Uploaded Photo (${photoMeta.fileName})`
                  : 'Extract Bill with Hisab Kitab'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Uploaded/Captured JPEG/PNG Preview OR Sample Bill Preview */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5">
          {photoMeta ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                    {photoMeta.format}
                  </span>
                  <span className="truncate text-xs font-bold text-slate-900">
                    {photoMeta.fileName}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {loading ? 'Analyzing with AI Vision...' : 'Uploaded Photo Active'}
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img
                  src={photoMeta.dataUrl}
                  alt={photoMeta.fileName}
                  className="max-h-72 w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href={photoMeta.dataUrl}
                  download={photoMeta.fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download {photoMeta.format}</span>
                </a>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runExtraction(selectedPreset, multimodalVoiceNote)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Re-Scan Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoMeta(null)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-bold text-slate-800">SAMPLE BILL PREVIEW</span>
                <span className="text-xs font-mono text-slate-500">
                  {selectedPreset === 'gupta_18500'
                    ? 'GT-INV-2026-402'
                    : selectedPreset === 'ramesh_kirana'
                      ? 'INV-AK-512'
                      : 'HW-KACHA-89'}
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-slate-300 bg-[#FFFDF9] p-4 font-mono text-xs text-slate-800">
                <div className="border-b border-dashed border-slate-300 pb-2 text-center">
                  <p className="text-sm font-bold">
                    {selectedPreset === 'gupta_18500'
                      ? 'GUPTA TRADERS WHOLESALE'
                      : selectedPreset === 'ramesh_kirana'
                        ? 'AGARWAL KIRANA & HARDWARE'
                        : 'KACHA PARCHI ESTIMATE'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedPreset === 'gupta_18500'
                      ? 'GSTIN: 08AABCG4921M1Z5 · Chandpole Mandi, Jaipur'
                      : 'Johari Bazar Main Road, Jaipur'}
                  </p>
                </div>
                <div className="my-2 flex justify-between text-[11px]">
                  <span>
                    Bill No:{' '}
                    {selectedPreset === 'gupta_18500'
                      ? 'GT-INV-2026-402'
                      : selectedPreset === 'ramesh_kirana'
                        ? 'INV-AK-512'
                        : 'HW-KACHA-89'}
                  </span>
                  <span>Date: 18-04-2026</span>
                </div>
                <div className="border-y border-dashed border-slate-300 py-2 space-y-1 text-[11px]">
                  {selectedPreset === 'gupta_18500' ? (
                    <>
                      <div className="flex justify-between">
                        <span>1. Sona Masoori Rice (5x50kg)</span>
                        <span>₹13,650</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2. Crystal Sugar M-30 (2x50kg)</span>
                        <span>₹4,850</span>
                      </div>
                    </>
                  ) : selectedPreset === 'ramesh_kirana' ? (
                    <>
                      <div className="flex justify-between">
                        <span>1. Sona Masoori Rice (4 Bag)</span>
                        <span>₹5,250</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2. Sunflower Oil Tin (15L)</span>
                        <span>₹1,050</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>1. PVC Pipe 1 Inch x 10</span>
                        <span>₹2,800</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2. Brass Elbows x 15 (Disc ₹150)</span>
                        <span>₹1,200</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-2 flex justify-between text-sm font-bold">
                  <span>GRAND TOTAL (Incl GST)</span>
                  <span>
                    {selectedPreset === 'gupta_18500'
                      ? '₹18,500'
                      : selectedPreset === 'ramesh_kirana'
                        ? '₹6,300'
                        : '₹4,000'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {loading && <HinglishLoader message={LOADING_MESSAGES[language].ocr} />}

      {/* OCR Extraction Confirmation Card */}
      {scanResult && !loading && (
        <div className="rounded-xl border-2 border-emerald-600 bg-white p-6 space-y-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                ✓ AI BILL ANALYSIS COMPLETE · ENGINE: {scanResult.providerUsed.toUpperCase()}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                Extracted Bill & Line Items (Editable Before Saving)
              </h2>
            </div>
            <div className="w-48">
              <ConfidenceBar
                confidence={scanResult.overallConfidence}
                label="Overall OCR Confidence"
              />
            </div>
          </div>

          {scanResult.voiceInstruction && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              <strong>Multimodal Voice Instruction Applied:</strong> “
              {scanResult.voiceInstruction.rawText}” → Assigned to customer{' '}
              <strong>{scanResult.voiceInstruction.targetCustomerName}</strong> (
              {scanResult.voiceInstruction.action === 'add_to_khata'
                ? 'Add to Khata'
                : 'Mark Paid'}
              ).
            </div>
          )}

          {scanResult.lowConfidenceFields.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
              <strong>⚠️ Low Confidence Fields Highlighted:</strong>{' '}
              {scanResult.lowConfidenceFields.join(', ')} scored below 80% confidence. Please
              verify these fields before clicking Confirm.
            </div>
          )}

          {/* Bill Type & Payment Status Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Bill Category:</span>
              <button
                type="button"
                onClick={() => {
                  setEditInvoiceType('sale');
                  setEditPartyType('customer');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  editPartyType === 'customer'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                Customer Sale / Fee Receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditInvoiceType('purchase');
                  setEditPartyType('supplier');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  editPartyType === 'supplier'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                Supplier Purchase / Expense Bill
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Payment Status:</span>
              <button
                type="button"
                onClick={() => setEditPaymentStatus('unpaid')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  editPaymentStatus === 'unpaid'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                Pending / Udhar (Add to Khata)
              </button>
              <button
                type="button"
                onClick={() => setEditPaymentStatus('paid')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  editPaymentStatus === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                Paid / Settled
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div
              className={`rounded-lg border p-3 ${
                scanResult.fieldConfidences.invoiceNumber < 80
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-slate-200'
              }`}
            >
              <label className="block text-xs font-semibold text-slate-700">
                Bill / Receipt No ({scanResult.fieldConfidences.invoiceNumber}%)
              </label>
              <input
                type="text"
                value={editInvNum}
                onChange={(e) => setEditInvNum(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono font-semibold"
              />
            </div>

            <div
              className={`rounded-lg border p-3 ${
                scanResult.fieldConfidences.partyName < 80
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-slate-200'
              }`}
            >
              <label className="block text-xs font-semibold text-slate-700">
                {editPartyType === 'supplier' ? 'Supplier / Vendor Name' : 'Customer / Student Name'}{' '}
                ({scanResult.fieldConfidences.partyName}%)
              </label>
              <input
                type="text"
                value={editPartyName}
                onChange={(e) => setEditPartyName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold"
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <label className="block text-xs font-semibold text-slate-700">
                Bill Date ({scanResult.fieldConfidences.issueDate}%)
              </label>
              <input
                type="date"
                value={editIssueDate}
                onChange={(e) => setEditIssueDate(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold"
              />
            </div>

            <div
              className={`rounded-lg border p-3 ${
                scanResult.fieldConfidences.total < 80
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-emerald-200 bg-emerald-50/30'
              }`}
            >
              <label className="block text-xs font-semibold text-emerald-900">
                Grand Total Amount (₹) ({scanResult.fieldConfidences.total}%)
              </label>
              <input
                type="number"
                value={editTotal}
                onChange={(e) => setEditTotal(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-emerald-400 bg-white px-2.5 py-1.5 text-sm font-bold tabular-nums text-emerald-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Extracted Line Items ({editItems.length})
              </h3>
              <button
                type="button"
                onClick={addScannedItemRow}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Item / Particulars</th>
                    <th className="px-3 py-2.5 w-24">Qty</th>
                    <th className="px-3 py-2.5 w-24">Unit</th>
                    <th className="px-3 py-2.5 w-32">Rate (₹)</th>
                    <th className="px-3 py-2.5 w-32 text-right">Amount (₹)</th>
                    <th className="px-3 py-2.5 w-16 text-center">Conf</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {editItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateScannedItemRow(idx, 'name', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateScannedItemRow(idx, 'quantity', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateScannedItemRow(idx, 'unit', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateScannedItemRow(idx, 'unitPrice', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.lineTotal}
                          onChange={(e) => updateScannedItemRow(idx, 'lineTotal', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-right text-xs font-bold tabular-nums text-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        <span
                          className={
                            item.confidence < 80
                              ? 'font-bold text-amber-700'
                              : 'text-emerald-700 font-medium'
                          }
                        >
                          {item.confidence}%
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeScannedItemRow(idx)}
                            className="text-slate-400 hover:text-red-600"
                            title="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setScanResult(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmScannedBill}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Check className="h-4 w-4" />
              <span>Confirm & Save Bill to Hisab Kitab</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
