import { creditOverpaidPayments } from "@/modules/finance";
import type { CheckoutPayment } from "./webhook-checkout-settlement";

/**
 * Bagian uang checkout yang tidak lagi dibutuhkan tagihannya menjadi saldo
 * kredit pelanggan: VA lama yang tetap dibayar setelah ganti metode (Duitku
 * tidak bisa menutup VA lebih awal), tagihan yang sudah lunas lewat jalur
 * lain, atau tagihan yang sudah dibatalkan. Logikanya milik finance karena
 * persetujuan transfer manual memakainya juga. Idempoten.
 */
export async function creditCheckoutOverpayment(checkout: CheckoutPayment[]) {
  await creditOverpaidPayments(checkout);
}
