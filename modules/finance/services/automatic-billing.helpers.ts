import { logger } from "@/lib/logger";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

const DEFAULT_BILLING_WINDOW_DAYS = 5;
const MIN_BILLING_WINDOW_DAYS = 0;
const MAX_BILLING_WINDOW_DAYS = 31;
const BILLING_BATCH_SIZE = 100;
/**
 * Berapa hari ke belakang jatuh tempo masih ikut dipindai.
 * Menutup kasus cron gagal beberapa hari tanpa membuat pemindaian melebar ke
 * seluruh pelanggan menunggak sepanjang sejarah.
 */
const BILLING_CATCH_UP_DAYS = 7;

export interface BillingCustomerPayload {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tenantId: string | null;
  tipe?: string;
  status?: string;
  hargaPaket: {
    id: string;
    name: string;
    harga: number;
    usePPN: boolean;
    ppnPercentage: number | null;
  };
}

/** Bentuk baris hasil query pelanggan yang eligible untuk billing harian. */
export interface EligibleBillingRow {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tenantId: string | null;
  tipe?: string;
  status?: string;
  hargaPaketId: string;
  paketName: string;
  paketHarga: number;
  paketUsePPN: boolean;
  paketPpnPercentage: number | null;
}

/**
 * Mengambil jumlah hari sebelum jatuh tempo dari setting string.
 * Nilai yang tidak valid atau di luar rentang wajar jatuh ke default —
 * tanpa guard ini, setting rusak menghasilkan NaN dan membuat seluruh
 * generate invoice harian menghasilkan Invalid Date tanpa error.
 */
export function parseBillingWindowDays(value?: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  const isWithinRange =
    Number.isFinite(parsed) &&
    parsed >= MIN_BILLING_WINDOW_DAYS &&
    parsed <= MAX_BILLING_WINDOW_DAYS;

  if (!isWithinRange && value != null && value !== "") {
    logger.warn(
      `[Billing] GENERAL_INVOICE_OTOMATIS tidak valid: "${value}" — pakai default ${DEFAULT_BILLING_WINDOW_DAYS} hari`,
    );
  }

  return isWithinRange ? parsed : DEFAULT_BILLING_WINDOW_DAYS;
}

/** Membuat tanggal target invoice dari hari ini dan offset setting. */
export function createTargetBillingDate(today: Date, daysBeforeDue: number) {
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysBeforeDue);
  return targetDate;
}

/**
 * Membuat rentang satu hari penuh untuk due date tertentu.
 * `end` memakai 23:59:59.999 supaya invoice dengan timestamp di sub-detik
 * terakhir tetap ikut terdeteksi oleh pengecekan duplikat.
 */
export function createDueDateRange(dueDate: Date) {
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth();
  const day = dueDate.getDate();

  return {
    start: new Date(year, month, day, 0, 0, 0, 0),
    end: new Date(year, month, day, 23, 59, 59, 999),
  };
}

/**
 * Rentang jatuh tempo yang layak ditagih hari ini.
 *
 * Batas atas = tanggal target (hari ini + window setting): pelanggan dengan
 * jatuh tempo lebih jauh tidak boleh ditagih lebih awal.
 * Batas bawah = beberapa hari ke belakang: jatuh tempo yang terlewat karena
 * cron mati tetap terkejar, sesuatu yang tidak mungkin dilakukan pencocokan
 * tanggal persis.
 */
export function createBillingCatchUpRange(
  today: Date,
  daysBeforeDue: number,
): { start: Date; end: Date } {
  const targetDate = createTargetBillingDate(today, daysBeforeDue);
  const rangeStart = new Date(targetDate);
  rangeStart.setDate(targetDate.getDate() - BILLING_CATCH_UP_DAYS);

  return {
    start: toStartOfDay(rangeStart),
    end: toEndOfDay(targetDate),
  };
}

/**
 * Tanggal jatuh tempo yang dipakai invoice: milik pelanggan itu sendiri,
 * dinormalkan ke awal hari supaya dedupe antar siklus konsisten.
 */
export function resolveInvoiceDueDate(jatuhTempo: Date): Date {
  return new Date(
    jatuhTempo.getFullYear(),
    jatuhTempo.getMonth(),
    jatuhTempo.getDate(),
  );
}

/** Kunci dedupe per pelanggan per siklus jatuh tempo. */
export function createExistingInvoiceKey(
  pelangganId: string,
  dueDate: Date,
): string {
  const month = String(dueDate.getMonth() + 1).padStart(2, "0");
  const day = String(dueDate.getDate()).padStart(2, "0");
  return `${pelangganId}|${dueDate.getFullYear()}-${month}-${day}`;
}

/** Mengambil ukuran batch billing harian. */
export function getBillingBatchSize() {
  return BILLING_BATCH_SIZE;
}

/** Memetakan row pelanggan eligible menjadi payload invoice customer. */
export function mapEligibleBillingRowToCustomer(
  row: EligibleBillingRow,
): BillingCustomerPayload {
  return {
    id: row.id,
    nama: row.nama,
    jatuhTempo: row.jatuhTempo,
    userId: row.userId,
    usePPN: row.usePPN,
    tenantId: row.tenantId,
    tipe: row.tipe,
    status: row.status,
    hargaPaket: {
      id: row.hargaPaketId,
      name: row.paketName,
      harga: row.paketHarga,
      usePPN: row.paketUsePPN,
      ppnPercentage: row.paketPpnPercentage,
    },
  };
}

type RealtimeBillingCustomer = {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tenantId: string | null;
  hargaPaket: {
    id: string;
    name: string;
    harga: number;
    usePPN: boolean;
    ppnPercentage: number | null;
  };
};

/** Membuat payload customer invoice dari entity pelanggan lengkap. */
export function mapRealtimeCustomerToBillingPayload(
  customer: RealtimeBillingCustomer,
) {
  const { id, nama, jatuhTempo, userId, usePPN, tenantId, hargaPaket } =
    customer;
  return {
    id,
    nama,
    jatuhTempo,
    userId,
    usePPN,
    tenantId,
    hargaPaket: { ...hargaPaket },
  };
}

/** Memeriksa apakah pelanggan valid untuk generate realtime invoice. */
export function canGenerateRealtimeInvoice(
  customer: {
    hargaPaket?: unknown;
    status?: string;
    tipe?: string;
  } | null,
) {
  if (!customer || !customer.hargaPaket) {
    return false;
  }

  if (customer.status !== "AKTIF" && customer.status !== "ISOLIR") {
    return false;
  }

  if (customer.status === "ISOLIR" && customer.tipe !== "REGULER") {
    return false;
  }

  return true;
}

/** Memeriksa apakah jatuh tempo pelanggan berada di dalam window generate invoice. */
export function isDueDateWithinBillingWindow(
  jatuhTempo: Date,
  daysBeforeDue: number,
) {
  const today = toStartOfDay(new Date());
  const targetDate = createTargetBillingDate(today, daysBeforeDue);
  targetDate.setTime(toEndOfDay(targetDate).getTime());
  return jatuhTempo <= targetDate;
}

/** Menambah satu bulan dengan penanganan akhir bulan yang aman. */
export function addSafeMonth(date: Date) {
  const nextDate = new Date(date);
  const currentDay = nextDate.getDate();
  nextDate.setMonth(nextDate.getMonth() + 1);

  if (nextDate.getDate() !== currentDay) {
    nextDate.setDate(0);
  }

  return nextDate;
}
