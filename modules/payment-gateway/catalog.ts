/**
 * Entry publik SEMPIT module payment-gateway: katalog metode pembayaran.
 *
 * Sengaja terpisah dari `index.ts`: index memuat seluruh service gateway,
 * yang sendirinya bergantung pada module finance. Repository finance hanya
 * butuh data katalog, dan pintu ini menjaganya bebas siklus.
 */
export {
  findBillingPaymentMethod,
  type BillingPaymentMethod,
} from "./services/payment-method-catalog";
