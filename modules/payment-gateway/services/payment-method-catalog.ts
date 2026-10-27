export type PaymentMethodCatalogItem = {
  id: string;
  name: string;
  provider: string;
  type: string;
  code: string;
  group: string;
  details?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
};

const DUITKU_PAYMENT_METHODS: PaymentMethodCatalogItem[] = [
  {
    id: "duitku_bca",
    name: "BCA Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BC",
    group: "Virtual Account",
  },
  {
    id: "duitku_mandiri",
    name: "Mandiri Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "M2",
    group: "Virtual Account",
  },
  {
    id: "duitku_bri",
    name: "BRI Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BR",
    group: "Virtual Account",
  },
  {
    id: "duitku_qris",
    name: "QRIS (Gopay, OVO, Dana, LinkAja)",
    provider: "DUITKU",
    type: "QRIS",
    code: "SP",
    group: "E-Wallet & QRIS",
  },
  {
    id: "duitku_alfamart",
    name: "Alfamart / Indomaret",
    provider: "DUITKU",
    type: "RETAIL",
    code: "FT",
    group: "Minimarket",
  },
];

const MOOTA_PAYMENT_METHODS: PaymentMethodCatalogItem[] = [
  {
    id: "moota_transfer",
    name: "Transfer Bank Otomatis",
    provider: "MOOTA",
    type: "AUTO_TRANSFER",
    code: "MOOTA_MANUAL",
    group: "Transfer Bank",
  },
];

// Kode channel resmi Tripay (tripay.co.id/developer). Dikirim apa adanya
// sebagai `method` saat membuat transaksi.
const TRIPAY_PAYMENT_METHODS: PaymentMethodCatalogItem[] = [
  ["BRIVA", "BRI Virtual Account", "VA", "Virtual Account"],
  ["BNIVA", "BNI Virtual Account", "VA", "Virtual Account"],
  ["MANDIRIVA", "Mandiri Virtual Account", "VA", "Virtual Account"],
  ["BCAVA", "BCA Virtual Account", "VA", "Virtual Account"],
  ["QRIS", "QRIS (Gopay, OVO, Dana, LinkAja)", "QRIS", "E-Wallet & QRIS"],
  ["ALFAMART", "Alfamart", "RETAIL", "Minimarket"],
  ["INDOMARET", "Indomaret", "RETAIL", "Minimarket"],
].map(([code, name, type, group]) => ({
  id: `tripay_${code.toLowerCase()}`,
  name,
  provider: "TRIPAY",
  type,
  code,
  group,
}));

// Gateway berhalaman bayar sendiri: pelanggan memilih channel di halaman
// gateway, jadi cukup satu metode. Kodenya unik supaya rute pembayaran tahu
// gateway mana yang dipakai.
const HOSTED_CHECKOUT_METHODS: Record<string, PaymentMethodCatalogItem[]> = {
  MIDTRANS: [hostedCheckout("MIDTRANS", "MIDTRANS_SNAP", "Midtrans")],
  XENDIT: [hostedCheckout("XENDIT", "XENDIT_INVOICE", "Xendit")],
  DANA: [hostedCheckout("DANA", "DANA_CHECKOUT", "DANA")],
};

function hostedCheckout(
  provider: string,
  code: string,
  label: string,
): PaymentMethodCatalogItem {
  return {
    id: code.toLowerCase(),
    name: `Bayar Online (${label})`,
    provider,
    type: "ONLINE",
    code,
    group: "Pembayaran Online",
  };
}

const CATALOG: Record<string, PaymentMethodCatalogItem[]> = {
  DUITKU: DUITKU_PAYMENT_METHODS,
  MOOTA: MOOTA_PAYMENT_METHODS,
  TRIPAY: TRIPAY_PAYMENT_METHODS,
  ...HOSTED_CHECKOUT_METHODS,
};

/**
 * Get static customer payment methods for an enabled provider.
 */
export function getCustomerPaymentMethodsByProvider(
  provider: string,
): PaymentMethodCatalogItem[] {
  return CATALOG[provider] ?? [];
}

/**
 * Gateway pemilik kode metode yang dipilih pelanggan; null untuk kode di
 * luar katalog (transfer manual, metode generik ONLINE).
 */
export function findPaymentMethodProvider(code: string): string | null {
  for (const [provider, methods] of Object.entries(CATALOG)) {
    if (methods.some((method) => method.code === code)) return provider;
  }
  return null;
}
