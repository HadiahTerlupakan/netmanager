import { createRouteServiceError } from "@/lib/api/route-service-error";
import { acquireLock } from "@/lib/distributed-lock";

const HTTP_CONFLICT = 409;
// Kunci harus hidup lebih lama dari kasus terburuk di dalamnya: cek status
// checkout lama (paralel, 10 detik), pembuatan checkout baru (30 detik
// termasuk percobaan ulang tanda tangan, DUITKU_REQUEST_TIMEOUT_MS),
// pembatalan di gateway (paralel, satu batas waktu gateway), dan query
// database. Kunci yang habis lebih dulu membuka pintu checkout ganda.
const CHECKOUT_LOCK_TTL_SECONDS = 120;
const CHECKOUT_BUSY_MESSAGE =
  "Pembayaran Anda sedang diproses di perangkat lain. Coba lagi sebentar lagi.";

/** Hasil `tryWithCustomerCheckoutLock`; tanpa kunci, tugasnya tidak dijalankan. */
export type CheckoutLockAttempt<T> =
  | { isAcquired: true; value: T }
  | { isAcquired: false };

/**
 * Jalankan `task` di bawah kunci checkout pelanggan bila kuncinya didapat.
 * Untuk pekerjaan latar yang boleh menunggu putaran berikutnya saat
 * pelanggan sedang membuat checkout (atau Redis mati).
 */
export async function tryWithCustomerCheckoutLock<T>(
  customerId: string,
  task: () => Promise<T>,
): Promise<CheckoutLockAttempt<T>> {
  const release = await acquireLock(`checkout:${customerId}`, {
    ttlSeconds: CHECKOUT_LOCK_TTL_SECONDS,
  });
  if (!release) return { isAcquired: false };
  try {
    return { isAcquired: true, value: await task() };
  } finally {
    await release();
  }
}

/**
 * Satu checkout per pelanggan dalam satu waktu. Tanpa kunci, dua perangkat
 * yang menekan "Ganti Metode" bersamaan sama-sama menutup checkout lama lalu
 * masing-masing membuat checkout baru, sehingga ada dua VA/QR yang bisa
 * dibayar untuk satu tagihan.
 *
 * Kuncinya di Redis, bukan advisory lock database: permintaan yang menunggu
 * tidak boleh memegang koneksi pool, atau pool habis dan pemegang kunci tak
 * bisa menyelesaikan query-nya sendiri. Bila kunci tidak didapat (termasuk
 * Redis mati), permintaan ditolak, seperti perpanjangan pelanggan.
 */
export async function withCustomerCheckoutLock<T>(
  customerId: string,
  task: () => Promise<T>,
): Promise<T> {
  const attempt = await tryWithCustomerCheckoutLock(customerId, task);
  if (!attempt.isAcquired) {
    throw createRouteServiceError(CHECKOUT_BUSY_MESSAGE, HTTP_CONFLICT);
  }
  return attempt.value;
}
