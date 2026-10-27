import { toStartOfDay } from "@/lib/utils/datetime";

export type StatusBayar = "LUNAS" | "BELUM_LUNAS";

/** Enum metode pembayaran yang diterima `POST /api/payments` dan `/renew`. */
type PaymentMethod = "CASH" | "BANK_TRANSFER" | "E_WALLET" | "OTHER";

export type Tagihan = {
  id: string;
  noTagihan: string;
  total: number;
  ppn: number;
  status: "BELUM_LUNAS" | "LUNAS" | "TERLAMBAT";
  jatuhTempo: string;
};

export type RenewFormState = {
  statusBayar: StatusBayar;
  metodePembayaran: MetodePembayaran;
  referensi: string;
  catatan: string;
};

export type RenewRequestBody = {
  statusBayar: StatusBayar;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
};

/**
 * Pilihan di form dipetakan ke enum payment. Dompet digital tidak punya enum
 * sendiri, jadi namanya ikut sebagai referensi supaya tetap terlacak.
 */
const METODE_KE_PAYMENT: Record<
  string,
  { paymentMethod: PaymentMethod; walletName?: string; label: string }
> = {
  PEMBAYARAN_MANUAL: { paymentMethod: "OTHER", label: "Pembayaran Manual" },
  TRANSFER: { paymentMethod: "BANK_TRANSFER", label: "Transfer" },
  CASH: { paymentMethod: "CASH", label: "Cash" },
  OVO: { paymentMethod: "E_WALLET", walletName: "OVO", label: "OVO" },
  DANA: { paymentMethod: "E_WALLET", walletName: "DANA", label: "DANA" },
  GOPAY: { paymentMethod: "E_WALLET", walletName: "GoPay", label: "GoPay" },
};

export type MetodePembayaran = keyof typeof METODE_KE_PAYMENT;

export const METODE_PEMBAYARAN_OPTIONS = Object.entries(METODE_KE_PAYMENT).map(
  ([value, { label }]) => ({ value, label }),
);

export const INITIAL_RENEW_FORM: RenewFormState = {
  statusBayar: "LUNAS",
  metodePembayaran: "PEMBAYARAN_MANUAL",
  referensi: "",
  catatan: "",
};

/** Susun body request `/renew` dari isian form. */
export function buildRenewRequestBody(form: RenewFormState): RenewRequestBody {
  const metode =
    METODE_KE_PAYMENT[form.metodePembayaran] ??
    METODE_KE_PAYMENT.PEMBAYARAN_MANUAL;
  const reference = [metode.walletName, form.referensi.trim()]
    .filter(Boolean)
    .join(" - ");
  const notes = form.catatan.trim();

  return {
    statusBayar: form.statusBayar,
    paymentMethod: metode.paymentMethod,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
  };
}

/** Tagihan pertama yang belum lunas dari respons `{ data: [...] }`. */
export function findTagihanTerbuka(raw: unknown): Tagihan | null {
  const list = (raw as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) return null;

  return (
    (list as Tagihan[]).find(
      (tagihan) =>
        tagihan.status === "BELUM_LUNAS" || tagihan.status === "TERLAMBAT",
    ) ?? null
  );
}

/**
 * Pesan bila hari ini belum masuk jendela perpanjangan (setting
 * `disablePerpanjanganPaket` hari sebelum jatuh tempo); null bila boleh.
 */
export function getRenewalWindowWarning(
  jatuhTempo: string,
  disableDuration: number,
  today: Date = new Date(),
): string | null {
  const allowedDate = toStartOfDay(new Date(jatuhTempo));
  allowedDate.setDate(allowedDate.getDate() - disableDuration);
  if (toStartOfDay(today) >= allowedDate) return null;

  return `Pelanggan ini belum dapat diperpanjang. Perpanjangan baru bisa dilakukan mulai ${formatTanggal(allowedDate)}.`;
}

export function formatTanggal(date: Date | string): string {
  return new Date(date).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
