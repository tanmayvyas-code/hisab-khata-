import type { Customer, ParsedBillScan, Supplier } from '../types/domain.ts';
import { matchPartiesFuzzy, parseVoiceTranscript } from './voiceParser.ts';

export function extractDemoBillScan(
  preset: 'gupta_18500' | 'ramesh_kirana' | 'handwritten_low_conf',
  voiceTranscript: string | undefined,
  customers: Customer[],
  suppliers: Supplier[]
): ParsedBillScan {
  let baseScan: ParsedBillScan;

  if (preset === 'handwritten_low_conf') {
    baseScan = {
      billNumber: 'HW-KACHA-89',
      invoiceNumber: 'INV-HW-089',
      invoiceType: 'sale',
      partyName: 'Ramesh Kumar',
      partyType: 'customer',
      issueDate: '2026-04-28',
      dueDate: '2026-05-12',
      subtotal: 4150,
      discount: 150,
      gstAmount: 0,
      total: 4000,
      paymentStatus: 'unpaid',
      overallConfidence: 74,
      fieldConfidences: {
        invoiceNumber: 68,
        partyName: 84,
        issueDate: 71,
        total: 76,
        gstAmount: 90,
        items: 72,
      },
      items: [
        {
          name: 'PVC Pipe 1 Inch (Supreme)',
          quantity: 10,
          unit: 'pcs',
          unitPrice: 280,
          discount: 0,
          gstRate: 0,
          lineTotal: 2800,
          confidence: 74,
        },
        {
          name: 'Brass Elbow Fittings (Handwritten)',
          quantity: 15,
          unit: 'pcs',
          unitPrice: 90,
          discount: 150,
          gstRate: 0,
          lineTotal: 1200,
          confidence: 66,
        },
      ],
      lowConfidenceFields: ['invoiceNumber', 'issueDate', 'total', 'items'],
      providerUsed: 'demo',
    };
  } else if (preset === 'ramesh_kirana') {
    baseScan = {
      billNumber: 'AK-2026-512',
      invoiceNumber: 'INV-AK-512',
      invoiceType: 'sale',
      partyName: 'Ramesh Kumar',
      partyType: 'customer',
      issueDate: '2026-04-28',
      dueDate: '2026-05-13',
      subtotal: 6200,
      discount: 200,
      gstAmount: 300,
      total: 6300,
      paymentStatus: 'unpaid',
      overallConfidence: 94,
      fieldConfidences: {
        invoiceNumber: 97,
        partyName: 95,
        issueDate: 96,
        total: 98,
        gstAmount: 92,
        items: 93,
      },
      items: [
        {
          name: 'Sona Masoori Rice (25kg Bag)',
          quantity: 4,
          unit: 'bag',
          weight: '100 kg',
          unitPrice: 1300,
          discount: 200,
          gstRate: 5,
          lineTotal: 5250,
          confidence: 95,
        },
        {
          name: 'Refined Sunflower Oil (15L Tin)',
          quantity: 1,
          unit: 'box',
          weight: '15 litre',
          unitPrice: 1000,
          discount: 0,
          gstRate: 5,
          lineTotal: 1050,
          confidence: 92,
        },
      ],
      lowConfidenceFields: [],
      providerUsed: 'demo',
    };
  } else {
    // Default Hero Demo: Gupta Traders ₹18,500 Invoice
    baseScan = {
      billNumber: 'GT-INV-2026-402',
      invoiceNumber: 'GT-INV-2026-402',
      invoiceType: 'purchase',
      partyName: 'Gupta Traders',
      partyType: 'supplier',
      partyGstin: '08AABCG4921M1Z5',
      issueDate: '2026-04-18',
      dueDate: '2026-04-25',
      subtotal: 17619,
      discount: 0,
      gstAmount: 881,
      total: 18500,
      paymentStatus: 'unpaid',
      overallConfidence: 96,
      fieldConfidences: {
        invoiceNumber: 98,
        partyName: 97,
        issueDate: 95,
        total: 99,
        gstAmount: 94,
        items: 95,
      },
      items: [
        {
          name: 'Sharbati / Sona Masoori Rice Wholesale (50kg)',
          quantity: 5,
          unit: 'bag',
          weight: '250 kg',
          unitPrice: 2600,
          discount: 0,
          gstRate: 5,
          lineTotal: 13650,
          confidence: 96,
        },
        {
          name: 'Crystal White Sugar M-30 (50kg)',
          quantity: 2,
          unit: 'bag',
          weight: '100 kg',
          unitPrice: 2309.5,
          discount: 0,
          gstRate: 5,
          lineTotal: 4850,
          confidence: 94,
        },
      ],
      lowConfidenceFields: [],
      providerUsed: 'demo',
    };
  }

  if (voiceTranscript && voiceTranscript.trim()) {
    const parsedVoice = parseVoiceTranscript(voiceTranscript, customers, suppliers);
    const targetName = parsedVoice.partyName || baseScan.partyName;
    const resolution = matchPartiesFuzzy(targetName, customers, []);
    baseScan.voiceInstruction = {
      rawText: voiceTranscript.trim(),
      targetCustomerName: resolution.matchedParties[0]?.name || targetName,
      matchedCustomers: resolution.matchedParties.map((p) => ({
        id: p.id,
        name: p.name,
        mobile: p.mobile,
      })),
      isAmbiguousCustomer: resolution.isAmbiguousParty,
      action: /paid|jama/i.test(voiceTranscript) ? 'mark_paid' : 'add_to_khata',
    };
    if (resolution.matchedParties.length === 1) {
      baseScan.partyName = resolution.matchedParties[0].name;
      baseScan.partyType = 'customer';
      baseScan.invoiceType = 'sale';
    } else if (targetName) {
      baseScan.partyName = targetName;
      baseScan.partyType = 'customer';
      baseScan.invoiceType = 'sale';
    }
  }

  return baseScan;
}
