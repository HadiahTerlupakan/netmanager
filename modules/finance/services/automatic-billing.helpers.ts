import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

const DEFAULT_BILLING_WINDOW_DAYS = 5;
const BILLING_BATCH_SIZE = 100;

export interface BillingCustomerPayload {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
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

interface EligibleBillingRow {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tipe?: string;
  status?: string;
  hargaPaketId: string;
  paketName: string;
  paketHarga: number;
  paketUsePPN: boolean;
  paketPpnPercentage: number | null;
}

/** Mengambil jumlah hari default sebelum jatuh tempo dari setting string. */
export function parseBillingWindowDays(value?: string | null) {
  return Number.parseInt(value || String(DEFAULT_BILLING_WINDOW_DAYS), 10);
}

/** Membuat tanggal target invoice dari hari ini dan offset setting. */
export function createTargetBillingDate(today: Date, daysBeforeDue: number) {
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysBeforeDue);
  return targetDate;
}

/** Membuat rentang satu hari penuh untuk due date tertentu. */
export function createDueDateRange(dueDate: Date) {
  return {
    start: new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
      0,
      0,
      0,
    ),
    end: new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
      23,
      59,
      59,
    ),
  };
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

/** Membuat payload customer invoice dari entity pelanggan lengkap. */
export function mapRealtimeCustomerToBillingPayload(customer: {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  hargaPaket: {
    id: string;
    name: string;
    harga: number;
    usePPN: boolean;
    ppnPercentage: number | null;
  };
}) {
  return {
    id: customer.id,
    nama: customer.nama,
    jatuhTempo: customer.jatuhTempo,
    userId: customer.userId,
    usePPN: customer.usePPN,
    hargaPaket: { ...customer.hargaPaket },
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
