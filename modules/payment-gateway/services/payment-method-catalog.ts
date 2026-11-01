export type PaymentMethodCatalogItem = {
  id: string;
  name: string;
  provider: string;
  type: string;
  code: string;
  group: string;
  /** Nominal terkecil yang diterima kanal; di bawahnya gateway menolak. */
  minAmount?: number;
  details?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
};

// Duitku menolak kanal bertanda ini di bawah Rp 10.000 dengan "Minimum
// Payment 10000 IDR" (uji produksi 2026-11-01 di Rp 9.990: BC, M2, BR, IR);
// QRIS, OVO, dan LinkAja menerima nominal yang sama. Dokumentasinya tidak
// memuat batas per kanal, jadi FT, DANA, dan ShopeePay, yang gagal oleh
// sebab lain, belum diketahui batasnya.
const DUITKU_MIN_PAYMENT_AMOUNT = 10_000;

const DUITKU_PAYMENT_METHODS: PaymentMethodCatalogItem[] = [
  {
    id: "duitku_bca",
    name: "BCA Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BC",
    group: "Virtual Account",
    minAmount: DUITKU_MIN_PAYMENT_AMOUNT,
  },
  {
    id: "duitku_mandiri",
    name: "Mandiri Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "M2",
    group: "Virtual Account",
    minAmount: DUITKU_MIN_PAYMENT_AMOUNT,
  },
  {
    id: "duitku_bri",
    name: "BRI Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BR",
    group: "Virtual Account",
    minAmount: DUITKU_MIN_PAYMENT_AMOUNT,
  },
  {
    id: "duitku_qris",
    name: "QRIS (Gopay, OVO, Dana, LinkAja)",
    provider: "DUITKU",
    type: "QRIS",
    code: "SP",
    group: "E-Wallet & QRIS",
  },
  // E-wallet tidak memberi nomor atau QR: Duitku mengembalikan link ke
  // aplikasi e-wallet, tempat pelanggan menyetujui pembayaran. GoPay tidak
  // tersedia sebagai channel langsung di Duitku; pelanggannya memakai QRIS.
  ...(
    [
      ["dana", "DANA", "DA"],
      ["ovo", "OVO", "OV"],
      ["shopeepay", "ShopeePay", "SA"],
      ["linkaja", "LinkAja", "LA"],
    ] as const
  ).map(([id, name, code]) => ({
    id: `duitku_${id}`,
    name,
    provider: "DUITKU",
    type: "EWALLET",
    code,
    group: "E-Wallet & QRIS",
  })),
  // Kanal FT hanya melayani Pegadaian, Alfamart, dan Pos; Indomaret punya
  // kanal sendiri (docs.duitku.com/api/id, daftar metode pembayaran).
  {
    id: "duitku_alfamart",
    name: "Alfamart / Pegadaian / Pos",
    provider: "DUITKU",
    type: "RETAIL",
    code: "FT",
    group: "Minimarket",
  },
  {
    id: "duitku_indomaret",
    name: "Indomaret",
    provider: "DUITKU",
    type: "RETAIL",
    code: "IR",
    group: "Minimarket",
    minAmount: DUITKU_MIN_PAYMENT_AMOUNT,
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

/** Nilai enum PaymentMethod billing yang punya padanan di katalog. */
export type BillingPaymentMethod = "BANK_TRANSFER" | "E_WALLET";

// Ritel dan halaman bayar gateway (kanalnya dipilih di sana) tetap OTHER.
const BILLING_METHOD_BY_TYPE: Record<string, BillingPaymentMethod> = {
  VA: "BANK_TRANSFER",
  AUTO_TRANSFER: "BANK_TRANSFER",
  QRIS: "E_WALLET",
  EWALLET: "E_WALLET",
};

/**
 * Enum PaymentMethod billing untuk kode kanal katalog (mis. "BC" →
 * BANK_TRANSFER); null bila tidak ada yang lebih tepat dari OTHER.
 * gatewayProvider tetap menyimpan kode kanalnya.
 */
export function findBillingPaymentMethod(
  code: string,
): BillingPaymentMethod | null {
  const method = findPaymentMethodByCode(code);
  return method ? (BILLING_METHOD_BY_TYPE[method.type] ?? null) : null;
}

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
/** Metode katalog dengan kode channel ini, di gateway mana pun. */
export function findPaymentMethodByCode(
  code: string,
): PaymentMethodCatalogItem | null {
  for (const methods of Object.values(CATALOG)) {
    const method = methods.find((item) => item.code === code);
    if (method) return method;
  }
  return null;
}

export function findPaymentMethodProvider(code: string): string | null {
  for (const [provider, methods] of Object.entries(CATALOG)) {
    if (methods.some((method) => method.code === code)) return provider;
  }
  return null;
}
