import type { Customer, ParsedVoiceCommand, Product, Supplier } from '../types/domain.ts';
import { computeNameSimilarity } from './reconciliationEngine.ts';

const HINDI_NUMBER_WORDS: Record<string, number> = {
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  gyarah: 11,
  barah: 12,
  pandra: 15,
  pandrah: 15,
  bees: 20,
  pachees: 25,
  pachis: 25,
  tees: 30,
  chalis: 40,
  pachaas: 50,
  pachas: 50,
  saath: 60,
  sattar: 70,
  assi: 80,
  nabbe: 90,
  sau: 100,
  hazaar: 1000,
  hazar: 1000,
};

const DEVANAGARI_MAP: Array<[RegExp, string]> = [
  [/को/g, ' ko '],
  [/ने/g, ' ne '],
  [/से/g, ' se '],
  [/के लिए/g, ' ke liye '],
  [/खाते में/g, ' khate mein '],
  [/अकाउंट में/g, ' account mein '],
  [/दिए|दिया|दे दिए|दे दो|बेचा|बेचे/g, ' diye '],
  [/लिया|लिये/g, ' liya '],
  [/उधार/g, ' udhaar '],
  [/नगद|कैश/g, ' cash '],
  [/बिक्री|सेल/g, ' sale '],
  [/पेमेंट/g, ' payment '],
  [/रुपये|रुपए|रुपया|रु/g, ' rupaye '],
  [/किलो|केजी/g, ' kilo '],
  [/ग्राम/g, ' gram '],
  [/लीटर/g, ' litre '],
  [/पीस|नग/g, ' pcs '],
  [/बोरी|बैग|कट्टा/g, ' bag '],
  [/पैकेट/g, ' packet '],
  [/और|तथा/g, ' aur '],
  [/आलू/g, ' Aalu '],
  [/प्याज|कांदा/g, ' Pyaaz '],
  [/टमाटर/g, ' Tamatar '],
  [/चावल/g, ' Rice '],
  [/चीनी|शक्कर/g, ' Sugar '],
  [/आटा|गेहूं/g, ' Atta '],
  [/तेल/g, ' Oil '],
  [/दाल/g, ' Dal '],
  [/नमक/g, ' Namak '],
  [/दूध/g, ' Milk '],
  [/घी/g, ' Ghee '],
  [/चाय/g, ' Chai '],
  [/साबुन/g, ' Soap '],
  [/सीमेंट/g, ' Cement '],
  [/पाइप/g, ' Pipe '],
  [/रमेश/g, ' Ramesh '],
  [/राहुल/g, ' Rahul '],
  [/अमित/g, ' Amit '],
  [/सुरेश/g, ' Suresh '],
  [/मोहन/g, ' Mohan '],
  [/प्रिया/g, ' Priya '],
  [/गुप्ता/g, ' Gupta '],
  [/शर्मा/g, ' Sharma '],
  [/अग्रवाल/g, ' Agarwal '],
  [/बालाजी/g, ' Balaji '],
];

const DEFAULT_ITEM_RATES: Record<string, { label: string; rate: number; unit: string }> = {
  aalu: { label: 'Aalu (Potato)', rate: 25, unit: 'kg' },
  aloo: { label: 'Aalu (Potato)', rate: 25, unit: 'kg' },
  potato: { label: 'Aalu (Potato)', rate: 25, unit: 'kg' },
  pyaaz: { label: 'Pyaaz (Onion)', rate: 35, unit: 'kg' },
  pyaj: { label: 'Pyaaz (Onion)', rate: 35, unit: 'kg' },
  kanda: { label: 'Pyaaz (Onion)', rate: 35, unit: 'kg' },
  onion: { label: 'Pyaaz (Onion)', rate: 35, unit: 'kg' },
  tamatar: { label: 'Tamatar (Tomato)', rate: 40, unit: 'kg' },
  tomato: { label: 'Tamatar (Tomato)', rate: 40, unit: 'kg' },
  rice: { label: 'Sona Masoori Rice', rate: 60, unit: 'kg' },
  chawal: { label: 'Chawal (Rice)', rate: 60, unit: 'kg' },
  basmati: { label: 'Basmati Rice', rate: 90, unit: 'kg' },
  sugar: { label: 'Crystal Sugar', rate: 45, unit: 'kg' },
  cheeni: { label: 'Cheeni (Sugar)', rate: 45, unit: 'kg' },
  chini: { label: 'Cheeni (Sugar)', rate: 45, unit: 'kg' },
  shakkar: { label: 'Shakkar (Sugar)', rate: 45, unit: 'kg' },
  atta: { label: 'Chakki Fresh Atta', rate: 38, unit: 'kg' },
  aata: { label: 'Chakki Fresh Atta', rate: 38, unit: 'kg' },
  gehu: { label: 'Gehu (Wheat)', rate: 32, unit: 'kg' },
  wheat: { label: 'Gehu (Wheat)', rate: 32, unit: 'kg' },
  dal: { label: 'Toor / Arhar Dal', rate: 120, unit: 'kg' },
  daal: { label: 'Toor / Arhar Dal', rate: 120, unit: 'kg' },
  oil: { label: 'Refined Cooking Oil', rate: 145, unit: 'litre' },
  tel: { label: 'Cooking Oil (Tel)', rate: 145, unit: 'litre' },
  milk: { label: 'Milk (Doodh)', rate: 60, unit: 'litre' },
  doodh: { label: 'Doodh (Milk)', rate: 60, unit: 'litre' },
  ghee: { label: 'Desi Ghee', rate: 550, unit: 'kg' },
  paneer: { label: 'Fresh Paneer', rate: 360, unit: 'kg' },
  namak: { label: 'Iodized Namak (Salt)', rate: 25, unit: 'kg' },
  salt: { label: 'Salt (Namak)', rate: 25, unit: 'kg' },
  chai: { label: 'Chai Patti (Tea)', rate: 240, unit: 'kg' },
  tea: { label: 'Tea (Chai Patti)', rate: 240, unit: 'kg' },
  soap: { label: 'Soap (Sabun)', rate: 35, unit: 'pcs' },
  sabun: { label: 'Sabun (Soap)', rate: 35, unit: 'pcs' },
  biscuit: { label: 'Biscuit Packet', rate: 20, unit: 'packet' },
  cement: { label: 'Portland Cement', rate: 380, unit: 'bag' },
  pipe: { label: 'PVC Pipe 1-Inch', rate: 280, unit: 'pcs' },
  sariya: { label: 'TMT Sariya (Steel)', rate: 72, unit: 'kg' },
};

const UNIT_ALIASES: Record<string, string> = {
  kilo: 'kg',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  gram: 'g',
  gm: 'g',
  g: 'g',
  litre: 'litre',
  liter: 'litre',
  ltr: 'litre',
  l: 'litre',
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  nag: 'pcs',
  bag: 'bag',
  bags: 'bag',
  bori: 'bag',
  katta: 'bag',
  box: 'box',
  packet: 'packet',
  pkt: 'packet',
  quintal: 'quintal',
  ton: 'ton',
};

const STOP_WORDS = new Set([
  'ko',
  'ne',
  'se',
  'ka',
  'ki',
  'ke',
  'liye',
  'mein',
  'me',
  'par',
  'pe',
  'diye',
  'diya',
  'de',
  'do',
  'liya',
  'liye',
  'becha',
  'becho',
  'bill',
  'banao',
  'banado',
  'add',
  'karo',
  'kardo',
  'daal',
  'jod',
  'rupaye',
  'rupees',
  'rs',
  'inr',
  'rate',
  'bhav',
  'hisaab',
  'hisab',
  'udhaar',
  'udhar',
  'jama',
  'mile',
  'payment',
  'cash',
  'sale',
  'aaj',
  'kal',
  'aur',
  'and',
  'plus',
  'to',
  'for',
  'from',
]);

function normalizeTranscriptNumbers(text: string): string {
  let out = text;
  // Convert Devanagari numerals ०-९ to 0-9
  const devDigits = '०१२३४५६७८९';
  for (let i = 0; i < 10; i++) {
    out = out.replace(new RegExp(devDigits[i], 'g'), String(i));
  }
  for (const [pattern, replacement] of DEVANAGARI_MAP) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/₹/g, ' ').replace(/,/g, '');
  // Convert "5 hazaar" -> 5000, "2 sau" -> 200
  out = out.replace(/(\d+)\s*(?:hazaar|hazar)\b/gi, (_, n) => String(Number(n) * 1000));
  out = out.replace(/(\d+)\s*sau\b/gi, (_, n) => String(Number(n) * 100));
  for (const [word, val] of Object.entries(HINDI_NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    out = out.replace(regex, String(val));
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function matchPartiesFuzzy(
  rawName: string | undefined,
  customers: Customer[],
  suppliers: Supplier[]
): {
  matchedParties: Array<{ id: string; name: string; type: 'customer' | 'supplier'; mobile?: string }>;
  isAmbiguousParty: boolean;
  isNewParty: boolean;
} {
  if (!rawName || !rawName.trim()) {
    return { matchedParties: [], isAmbiguousParty: false, isNewParty: false };
  }
  const query = rawName.trim().toLowerCase();
  const matches: Array<{
    id: string;
    name: string;
    type: 'customer' | 'supplier';
    mobile?: string;
    score: number;
  }> = [];

  for (const c of customers) {
    const cLower = c.name.toLowerCase();
    const firstToken = cLower.split(/\s+/)[0];
    const sim =
      cLower === query
        ? 1
        : firstToken === query || cLower.startsWith(query)
          ? 0.9
          : computeNameSimilarity(rawName, c.name);
    if (sim >= 0.65) {
      matches.push({ id: c.id, name: c.name, type: 'customer', mobile: c.mobile, score: sim });
    }
  }

  for (const s of suppliers) {
    const sLower = s.name.toLowerCase();
    const firstToken = sLower.split(/\s+/)[0];
    const sim =
      sLower === query
        ? 1
        : firstToken === query || sLower.startsWith(query)
          ? 0.9
          : computeNameSimilarity(rawName, s.name);
    if (sim >= 0.65) {
      matches.push({ id: s.id, name: s.name, type: 'supplier', mobile: s.contact, score: sim });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const topScore = matches[0]?.score || 0;
  const highMatches = matches.filter((m) => m.score >= topScore - 0.1);

  return {
    matchedParties: highMatches.map(({ id, name, type, mobile }) => ({ id, name, type, mobile })),
    isAmbiguousParty: highMatches.length > 1,
    isNewParty: highMatches.length === 0,
  };
}

function capitalizeWords(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function extractPartyAndRemainingText(
  normalized: string,
  customers: Customer[],
  suppliers: Supplier[]
): { partyName: string; remainingText: string } {
  // 1. Check if "<Name> ko / ke liye / ka / ki / ke / ne / se" appears at the start of the sentence
  const startMatch = normalized.match(
    /^([A-Za-z][A-Za-z\s.&]{1,28}?)\s+(?:ko|ka|ki|ke\s+liye|ke\s+naam|ke\s+khate\s+mein|ke\s+account\s+mein)\s+(.+)$/i
  );
  if (startMatch) {
    const candidate = startMatch[1].trim();
    const candidateTokens = candidate.toLowerCase().split(/\s+/);
    const hasUnitOrItemOnly = candidateTokens.some(
      (t) => UNIT_ALIASES[t] || DEFAULT_ITEM_RATES[t] || STOP_WORDS.has(t)
    );
    if (!hasUnitOrItemOnly) {
      return {
        partyName: capitalizeWords(candidate),
        remainingText: startMatch[2]
          .replace(/\s+(?:diye|diya|de\s+do|becha|becho|udhaar\s+diye|bill\s+banao)\s*$/i, '')
          .trim(),
      };
    }
  }

  // 2. Check if "<Name> ko (diye/diya/becha/bill...)" appears at the END or MIDDLE of the sentence!
  // Example: "Aalu 100 kilo Ramesh ko Diye" or "100 kilo aalu Ramesh Kumar ko diye"
  const anywhereKoRegex =
    /\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:ko|ke\s+liye|ke\s+naam|ke\s+khate\s+mein)(?:\s+(?:diye|diya|de\s+diye|de\s+do|becha|becho|udhaar|likho|add\s+karo|daal\s+do))?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = anywhereKoRegex.exec(normalized)) !== null) {
    const rawCandidate = match[1].trim();
    // Filter out any leading unit or item words if two words were captured (e.g. "kilo Ramesh" -> "Ramesh")
    const words = rawCandidate.split(/\s+/);
    const filteredWords = words.filter((w) => {
      const lw = w.toLowerCase();
      return !UNIT_ALIASES[lw] && !DEFAULT_ITEM_RATES[lw] && !STOP_WORDS.has(lw) && !/^\d+$/.test(lw);
    });

    if (filteredWords.length > 0) {
      const party = capitalizeWords(filteredWords.join(' '));
      // Remove "<filteredWords> ko (diye...)" from the sentence
      const phraseToRemove = new RegExp(
        `\\b${filteredWords.join('\\s+')}\\s+(?:ko|ke\\s+liye|ke\\s+naam|ke\\s+khate\\s+mein)(?:\\s+(?:diye|diya|de\\s+diye|de\\s+do|becha|becho|udhaar|likho|add\\s+karo|daal\\s+do))?\\b`,
        'i'
      );
      const remaining = normalized
        .replace(phraseToRemove, ' ')
        .replace(/\b(?:diye|diya|de\s+do|becha|bill\s+banao)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { partyName: party, remainingText: remaining };
    }
  }

  // 3. Check English "to <Name>" or "for <Name>"
  const toMatch = normalized.match(/\b(?:to|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
  if (toMatch) {
    const candidate = toMatch[1].trim();
    if (!UNIT_ALIASES[candidate.toLowerCase()] && !DEFAULT_ITEM_RATES[candidate.toLowerCase()]) {
      const remaining = normalized.replace(toMatch[0], ' ').replace(/\s+/g, ' ').trim();
      return { partyName: capitalizeWords(candidate), remainingText: remaining };
    }
  }

  // 4. Check if any existing customer or supplier name appears directly in the transcript
  for (const c of [...customers, ...suppliers]) {
    const firstName = c.name.split(/\s+/)[0];
    const nameRegex = new RegExp(`\\b(${c.name}|${firstName})\\b`, 'i');
    const found = normalized.match(nameRegex);
    if (found) {
      const remaining = normalized
        .replace(nameRegex, ' ')
        .replace(/\b(?:ko|ne|se|diye|diya|becha)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { partyName: c.name, remainingText: remaining };
    }
  }

  // 5. Check if the sentence starts or ends with a person's name alongside numbers/items (e.g. "Mohan 1500" or "Tanmay Vyas 38000")
  const tokens = normalized.split(/\s+/);
  const nameTokens: string[] = [];
  for (const tok of tokens) {
    const lw = tok.toLowerCase();
    if (
      /^[A-Za-z]{2,}$/.test(tok) &&
      !UNIT_ALIASES[lw] &&
      !DEFAULT_ITEM_RATES[lw] &&
      !STOP_WORDS.has(lw)
    ) {
      nameTokens.push(tok);
      if (nameTokens.length === 2) break;
    } else if (nameTokens.length > 0) {
      break;
    }
  }
  if (nameTokens.length > 0) {
    const candidateName = capitalizeWords(nameTokens.join(' '));
    const rem = normalized
      .replace(new RegExp(`\\b${nameTokens.join('\\s+')}\\b`, 'i'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/\d/.test(rem)) {
      return { partyName: candidateName, remainingText: rem };
    }
  }

  return { partyName: 'Walk-in Customer', remainingText: normalized };
}

function resolveProductRateAndUnit(
  rawItemName: string,
  spokenUnit: string | undefined,
  spokenRate: number | undefined,
  products: Product[]
): {
  name: string;
  productId?: string;
  unit: string;
  unitPrice: number;
  isEstimatedRate: boolean;
} {
  const cleanKey = rawItemName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  // 1. Check shop's product catalog
  const matchedProd = products.find(
    (p) =>
      p.name.toLowerCase().includes(cleanKey) ||
      cleanKey.includes(p.name.toLowerCase().split(/\s+/)[0])
  );

  // 2. Check common Indian Kirana/Mandi commodity dictionary
  const dictEntry =
    DEFAULT_ITEM_RATES[cleanKey] ||
    Object.entries(DEFAULT_ITEM_RATES).find(([k]) => cleanKey.includes(k))?.[1];

  const normalizedSpokenUnit = spokenUnit ? UNIT_ALIASES[spokenUnit.toLowerCase()] || spokenUnit.toLowerCase() : undefined;
  const unit = normalizedSpokenUnit || matchedProd?.unit || dictEntry?.unit || 'kg';

  if (spokenRate !== undefined && spokenRate > 0) {
    return {
      name: matchedProd?.name || dictEntry?.label || capitalizeWords(rawItemName),
      productId: matchedProd?.id,
      unit,
      unitPrice: spokenRate,
      isEstimatedRate: false,
    };
  }

  const fallbackRate = matchedProd?.sellingPrice || dictEntry?.rate || 50;
  return {
    name: matchedProd?.name || dictEntry?.label || capitalizeWords(rawItemName),
    productId: matchedProd?.id,
    unit,
    unitPrice: fallbackRate,
    isEstimatedRate: true,
  };
}

export function parseVoiceTranscript(
  rawTranscript: string,
  customers: Customer[],
  suppliers: Supplier[],
  products: Product[] = []
): ParsedVoiceCommand {
  const trimmed = rawTranscript.trim();
  const normalized = normalizeTranscriptNumbers(trimmed);
  const lower = normalized.toLowerCase();

  // 1. Check Multimodal instruction ("Isko Ramesh ke account mein add kar do" / "Ramesh ke khate mein daal do")
  const multimodalMatch = normalized.match(
    /(?:isko|ye\s+bill|bill\s+ko)?\s*([A-Za-z][A-Za-z\s]{1,25}?)\s+ke\s+(?:account|khate|khata)\s+mein\s+(?:add|daal|jod)/i
  );
  if (multimodalMatch) {
    const partyName = multimodalMatch[1].replace(/^(isko|ye|bill)\s+/i, '').trim();
    const partyResolution = matchPartiesFuzzy(partyName, customers, suppliers);
    return {
      intent: 'multimodal_assign',
      rawTranscript: trimmed,
      partyName: partyResolution.matchedParties[0]?.name || capitalizeWords(partyName),
      matchedParties: partyResolution.matchedParties,
      isAmbiguousParty: partyResolution.isAmbiguousParty,
      isNewParty: partyResolution.isNewParty,
      items: [],
      totalAmount: 0,
      confidence: 95,
      explanation: partyResolution.isAmbiguousParty
        ? `Kaun sa ${partyName}? (${partyResolution.matchedParties.map((p) => p.name).join(' / ')})`
        : `Scanned bill ko ${partyResolution.matchedParties[0]?.name || capitalizeWords(partyName)} ke khate mein jodna hai.`,
    };
  }

  // 2. Check Cash Sale ("Aaj cash sale ₹15,000 hui" / "Cash sale 15000")
  if (/\bcash\s+sale\b|\bnagad\s+bikri\b/i.test(lower)) {
    const amtMatch = normalized.match(/(\d+(?:\.\d+)?)/);
    const amount = amtMatch ? Number(amtMatch[1]) : 0;
    return {
      intent: 'cash_sale',
      rawTranscript: trimmed,
      partyName: 'Walk-in Cash Customer',
      matchedParties: [],
      isAmbiguousParty: false,
      isNewParty: false,
      items: [
        {
          name: 'Daily Cash Sale Counter',
          quantity: 1,
          unit: 'pcs',
          unitPrice: amount,
          lineTotal: amount,
        },
      ],
      totalAmount: amount,
      paymentMethod: 'cash',
      confidence: 94,
      explanation: `Aaj ki nagad bikri (Cash Sale) ₹${amount.toLocaleString('en-IN')} record karein.`,
    };
  }

  // 3. Check Payment Received ("Rahul ne ₹2,000 de diye" / "Rahul se 2000 mile" / "Rahul ko ₹2,000 payment add karo")
  const paymentRecMatch = normalized.match(
    /^([A-Za-z][A-Za-z\s]{1,30}?)\s+(?:ne|se|ko)\s+(\d+(?:\.\d+)?)\s*(?:rupaye|rs|inr)?\s*(?:de\s+diye|jama\s+kiye|mile|payment\s+add\s+karo|jama\s+karo)$/i
  );
  if (paymentRecMatch) {
    const rawParty = paymentRecMatch[1].trim();
    const amount = Number(paymentRecMatch[2]);
    const partyResolution = matchPartiesFuzzy(rawParty, customers, suppliers);
    return {
      intent: 'payment_received',
      rawTranscript: trimmed,
      partyName: partyResolution.matchedParties[0]?.name || capitalizeWords(rawParty),
      matchedParties: partyResolution.matchedParties,
      isAmbiguousParty: partyResolution.isAmbiguousParty,
      isNewParty: partyResolution.isNewParty,
      items: [],
      totalAmount: amount,
      paymentMethod: /upi|gpay|phonepe/i.test(lower) ? 'UPI' : 'cash',
      confidence: 95,
      explanation: partyResolution.isAmbiguousParty
        ? `Kaun sa ${rawParty}? Kripya customer chunein.`
        : `${partyResolution.matchedParties[0]?.name || capitalizeWords(rawParty)} se ₹${amount.toLocaleString('en-IN')} payment jama karein.`,
    };
  }

  // 4. Check Supplier Payment ("Gupta Traders ko ₹18,500 payment ki" / "Gupta Traders ko 18500 bheje")
  const supplierPayMatch = normalized.match(
    /^([A-Za-z][A-Za-z\s.&]{1,35}?)\s+ko\s+(\d+(?:\.\d+)?)\s*(?:rupaye|rs|inr)?\s*(?:ki\s+)?(?:payment\s+ki|payment\s+diya|bheje|transfer\s+kiye)/i
  );
  if (supplierPayMatch) {
    const rawParty = supplierPayMatch[1].trim();
    const amount = Number(supplierPayMatch[2]);
    const partyResolution = matchPartiesFuzzy(rawParty, customers, suppliers);
    return {
      intent: 'supplier_payment',
      rawTranscript: trimmed,
      partyName: partyResolution.matchedParties[0]?.name || capitalizeWords(rawParty),
      matchedParties: partyResolution.matchedParties,
      isAmbiguousParty: partyResolution.isAmbiguousParty,
      isNewParty: partyResolution.isNewParty,
      items: [],
      totalAmount: amount,
      paymentMethod: 'UPI',
      confidence: 94,
      explanation: `Supplier ${partyResolution.matchedParties[0]?.name || capitalizeWords(rawParty)} ko ₹${amount.toLocaleString('en-IN')} payment record karein.`,
    };
  }

  // 5. Check Credit Sale ("Ramesh ne ₹5,000 ka maal udhaar liya")
  const creditSaleMatch = normalized.match(
    /^([A-Za-z][A-Za-z\s]{1,30}?)\s+(?:ne|ko)\s+(\d+(?:\.\d+)?)\s*(?:rupaye|rs)?\s*(?:ka\s+)?(?:maal|samaan)?\s*udhaar\s+(?:liya|diya|diye)/i
  );
  if (creditSaleMatch) {
    const rawParty = creditSaleMatch[1].trim();
    const amount = Number(creditSaleMatch[2]);
    const partyResolution = matchPartiesFuzzy(rawParty, customers, suppliers);
    return {
      intent: 'credit_sale',
      rawTranscript: trimmed,
      partyName: partyResolution.matchedParties[0]?.name || capitalizeWords(rawParty),
      matchedParties: partyResolution.matchedParties,
      isAmbiguousParty: partyResolution.isAmbiguousParty,
      isNewParty: partyResolution.isNewParty,
      items: [
        {
          name: 'General Kirana / Hardware Maal (Udhaar)',
          quantity: 1,
          unit: 'pcs',
          unitPrice: amount,
          lineTotal: amount,
        },
      ],
      totalAmount: amount,
      confidence: 93,
      explanation: partyResolution.isAmbiguousParty
        ? `Kaun sa ${rawParty}? Kripya confirm karein.`
        : `${partyResolution.matchedParties[0]?.name || capitalizeWords(rawParty)} ke khate mein ₹${amount.toLocaleString('en-IN')} udhaar bill banayein.`,
    };
  }

  // 6. Flexible Itemized & General Voice Billing
  // Supports:
  // - "Ramesh ko 5 kilo rice 60 rupaye kilo aur 2 kilo sugar 45 rupaye kilo"
  // - "Aalu 100 kilo Ramesh ko Diye"
  // - "Aalu 100 kilo 25 rupaye Ramesh ko diye"
  // - "100 kilo Aalu Ramesh ko diye"
  // - "Ramesh ko 500 ka aalu diya"
  const { partyName, remainingText } = extractPartyAndRemainingText(
    normalized,
    customers,
    suppliers
  );

  const segments = remainingText
    .split(/\s+(?:aur|and|plus|,|&)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsedItems: ParsedVoiceCommand['items'] = [];
  let hasEstimatedRate = false;

  const unitPattern =
    '(?:kilo|kg|kgs|kilogram|gram|gm|g|litre|liter|ltr|pcs|pc|piece|pieces|nag|bag|bags|bori|katta|box|packet|pkt|quintal|ton)';

  for (const rawSeg of segments) {
    const seg = rawSeg
      .replace(/\b(?:diye|diya|de\s+diye|de\s+do|becha|liya|bill\s+banao)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!seg) continue;

    // Pattern A: "<qty> <unit?> <itemName> <rate> (rupaye/rs...)"
    // e.g. "5 kilo rice 60 rupaye kilo"
    const pA = seg.match(
      new RegExp(
        `^(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?\\s+([A-Za-z][A-Za-z\\s]{1,25}?)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:rupaye|rs|ka|ke|rate|bhav|per|kilo|kg)?`,
        'i'
      )
    );
    if (pA) {
      const qty = Number(pA[1]);
      const rawUnit = pA[2];
      const rawItem = pA[3].replace(/\b(rate|ke|ka|bhav|mein|par)\b/gi, '').trim();
      const num2 = Number(pA[4]);
      const resolved = resolveProductRateAndUnit(rawItem, rawUnit, num2, products);
      parsedItems.push({
        name: resolved.name,
        productId: resolved.productId,
        quantity: qty,
        unit: resolved.unit,
        unitPrice: resolved.unitPrice,
        lineTotal: Math.round(qty * resolved.unitPrice),
      });
      continue;
    }

    // Pattern B: "<itemName> <qty> <unit?> <rate?> (rupaye/rs...)"
    // e.g. "Aalu 100 kilo" OR "Aalu 100 kilo 25 rupaye"
    const pB = seg.match(
      new RegExp(
        `^([A-Za-z][A-Za-z\\s]{1,25}?)\\s+(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?(?:\\s+(?:@|rate|ke\\s+bhav|bhav)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:rupaye|rs|ka|ke|rate|bhav|per|kilo|kg)?)?$`,
        'i'
      )
    );
    if (pB) {
      const rawItem = pB[1].replace(/\b(ka|ki|ke|ko|mein)\b/gi, '').trim();
      const qty = Number(pB[2]);
      const rawUnit = pB[3];
      const optionalRate = pB[4] ? Number(pB[4]) : undefined;

      // If user said "Aalu 500 rupaye" or "Tuition fee 38000" (where number is the amount and no unit like kilo was given)
      const matchedKnownProduct = products.find((p) =>
        p.name.toLowerCase().includes(rawItem.toLowerCase())
      );
      const isAmountOnly =
        !rawUnit &&
        !optionalRate &&
        (/\b(?:rupaye|rs|ka|fee|fees|charge|charges|bill|rent|kiraya|samaan|maal|service)\b/i.test(
          seg
        ) ||
          (!matchedKnownProduct && qty >= 50));
      if (isAmountOnly) {
        const resolved = resolveProductRateAndUnit(rawItem, 'pcs', qty, products);
        parsedItems.push({
          name: resolved.name,
          productId: resolved.productId,
          quantity: 1,
          unit: 'pcs',
          unitPrice: qty,
          lineTotal: qty,
        });
      } else {
        const resolved = resolveProductRateAndUnit(rawItem, rawUnit, optionalRate, products);
        if (resolved.isEstimatedRate) hasEstimatedRate = true;
        parsedItems.push({
          name: resolved.name,
          productId: resolved.productId,
          quantity: qty,
          unit: resolved.unit,
          unitPrice: resolved.unitPrice,
          lineTotal: Math.round(qty * resolved.unitPrice),
        });
      }
      continue;
    }

    // Pattern C: "<qty> <unit> <itemName>" (without explicit rate)
    // e.g. "100 kilo Aalu" or "5 bag cement"
    const pC = seg.match(
      new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\s*(?:ka|ki|ke)?\\s+([A-Za-z][A-Za-z\\s]{1,25})$`, 'i')
    );
    if (pC) {
      const qty = Number(pC[1]);
      const rawUnit = pC[2];
      const rawItem = pC[3].trim();
      const resolved = resolveProductRateAndUnit(rawItem, rawUnit, undefined, products);
      if (resolved.isEstimatedRate) hasEstimatedRate = true;
      parsedItems.push({
        name: resolved.name,
        productId: resolved.productId,
        quantity: qty,
        unit: resolved.unit,
        unitPrice: resolved.unitPrice,
        lineTotal: Math.round(qty * resolved.unitPrice),
      });
      continue;
    }

    // Pattern D: "<amount> (rupaye/ka)? <itemName>"
    // e.g. "500 ka aalu", "38000 tuition fee", "5000 bus fee", "1200 rupaye ka samaan"
    const pD = seg.match(/^(\d+(?:\.\d+)?)\s*(?:rupaye|rs)?\s*(?:ka|ki|ke)?\s+([A-Za-z][A-Za-z\s]{1,30})$/i);
    if (pD) {
      const amount = Number(pD[1]);
      const rawItem = pD[2].replace(/\b(?:ka|ki|ke|bill|banao)\b/gi, '').trim();
      const resolved = resolveProductRateAndUnit(rawItem || 'Bill Item', 'pcs', amount, products);
      parsedItems.push({
        name: resolved.name,
        productId: resolved.productId,
        quantity: 1,
        unit: 'pcs',
        unitPrice: amount,
        lineTotal: amount,
      });
      continue;
    }
  }

  if (parsedItems.length > 0) {
    const totalAmount = parsedItems.reduce((s, item) => s + item.lineTotal, 0);
    const partyResolution = matchPartiesFuzzy(partyName, customers, suppliers);
    const resolvedPartyName = partyResolution.matchedParties[0]?.name || partyName;
    const rateNote = hasEstimatedRate
      ? ' (Mandi/Shop default rate lagaya gaya hai — aap niche Rate edit kar sakte hain)'
      : '';

    return {
      intent: 'create_bill',
      rawTranscript: trimmed,
      partyName: resolvedPartyName,
      matchedParties: partyResolution.matchedParties,
      isAmbiguousParty: partyResolution.isAmbiguousParty,
      isNewParty: partyResolution.isNewParty && partyName !== 'Walk-in Customer',
      items: parsedItems,
      totalAmount,
      confidence: hasEstimatedRate ? 91 : 96,
      explanation: partyResolution.isAmbiguousParty
        ? `Kaun sa ${partyName}? (${partyResolution.matchedParties.map((p) => p.name).join(' / ')})`
        : `${resolvedPartyName} ke liye ${parsedItems.map((i) => `${i.name} (${i.quantity} ${i.unit} × ₹${i.unitPrice})`).join(', ')} ka bill (Total ₹${totalAmount.toLocaleString('en-IN')}) taiyaar hai.${rateNote}`,
    };
  }

  // 7. Fallback: If a party name and a number were spoken (e.g., "Ramesh ko 1500 diye")
  const fallbackNum = remainingText.match(/(\d+(?:\.\d+)?)/);
  if (partyName !== 'Walk-in Customer' && fallbackNum) {
    const amount = Number(fallbackNum[1]);
    const partyResolution = matchPartiesFuzzy(partyName, customers, suppliers);
    const resolvedPartyName = partyResolution.matchedParties[0]?.name || partyName;
    return {
      intent: 'create_bill',
      rawTranscript: trimmed,
      partyName: resolvedPartyName,
      matchedParties: partyResolution.matchedParties,
      isAmbiguousParty: partyResolution.isAmbiguousParty,
      isNewParty: partyResolution.isNewParty,
      items: [
        {
          name: 'General Shop Items',
          quantity: 1,
          unit: 'lot',
          unitPrice: amount,
          lineTotal: amount,
        },
      ],
      totalAmount: amount,
      confidence: 88,
      explanation: `${resolvedPartyName} ke liye ₹${amount.toLocaleString('en-IN')} ka bill taiyaar hai.`,
    };
  }

  return {
    intent: 'unknown',
    rawTranscript: trimmed,
    matchedParties: [],
    isAmbiguousParty: false,
    isNewParty: false,
    items: [],
    totalAmount: 0,
    confidence: 40,
    explanation:
      'Command clear nahi hua. Example try karein: "Aalu 100 kilo Ramesh ko Diye" ya "Ramesh ko 5 kilo rice 60 rupaye kilo".',
  };
}
