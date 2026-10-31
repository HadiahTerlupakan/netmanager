import { apiError, ErrorCodes } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Batas permintaan per pelanggan untuk rute pembayaran portal dan aplikasi,
 * memakai pembatas yang sama dengan rute login. Kuncinya id pelanggan, bukan
 * IP: pelanggan seluler berbagi IP lewat CGNAT.
 *
 * Tiap rute ini memanggil gateway, membuka aliran SSE, atau menulis berkas,
 * sehingga perulangan dari klien yang macet mudah membebani Duitku (yang
 * memblokir merchant sekitar satu jam bila cek status terlalu sering).
 */
const CUSTOMER_PAYMENT_LIMITS = {
  createPayment: 10,
  checkStatus: 12,
  cancelPayment: 5,
  uploadReceipt: 5,
  verifyCoupon: 10,
  paymentStream: 10,
} as const;

export type CustomerPaymentAction = keyof typeof CUSTOMER_PAYMENT_LIMITS;

/** Respons 429 bila pelanggan melewati batas aksi ini; null bila boleh lanjut. */
export function limitCustomerPaymentRequest(
  action: CustomerPaymentAction,
  customerId: string,
) {
  if (
    rateLimit(
      `customer-${action}:${customerId}`,
      CUSTOMER_PAYMENT_LIMITS[action],
    )
  ) {
    return null;
  }

  return apiError(
    "Terlalu banyak permintaan. Coba lagi dalam 1 menit.",
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    { status: 429 },
  );
}
