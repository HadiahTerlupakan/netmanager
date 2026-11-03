import type { PaidInvoiceAmounts } from "./ports/IInvoicePaymentStatusReader";
import type { ResellerCommissionTypeValue } from "./entities/ResellerCommissionEntity";

const PERCENT_DIVISOR = 100;

/**
 * Dasar komisi reseller = DPP, yaitu nilai tagihan tanpa PPN.
 *
 * PPN adalah titipan pajak pelanggan yang disetor ISP ke negara, bukan
 * pendapatan yang dihasilkan reseller, jadi komisi tidak dihitung darinya.
 * Invoice menyimpan `taxAmount` (PPN keluaran) dan `totalAmount` (termasuk
 * PPN, sesudah potongan harga dan sesudah saldo kredit terpakai).
 *
 * Saldo kredit (mis. sisa prorate downgrade) adalah uang pelanggan yang sudah
 * diterima ISP, jadi diperlakukan sebagai alat bayar dan dikembalikan ke
 * dasar: layanan tetap terjual dan pendapatannya tetap diakui. Potongan harga
 * sungguhan (diskon admin) tetap mengurangi DPP, karena PPN-nya pun dihitung
 * dari nilai sesudah potongan.
 *
 *   DPP = total + saldo kredit terpakai − PPN
 *
 * Contoh: paket Rp100.000 + PPN 11% = Rp111.000 → DPP Rp100.000, juga bila
 * seluruhnya dilunasi saldo kredit (total Rp0); tanpa PPN → DPP = total.
 * Tidak pernah negatif.
 */
export function calculateCommissionBase(amounts: PaidInvoiceAmounts): number {
  const grossBeforeCredit = amounts.totalAmount + amounts.saldoKreditUsed;
  return Math.max(0, Math.trunc(grossBeforeCredit - amounts.taxAmount));
}

/** Aturan yang menentukan besar komisi. */
export interface CommissionRate {
  readonly type: ResellerCommissionTypeValue;
  /** Persen bulat 0–100 (kolom `rate` Int). */
  readonly rate: number | null;
  /** Rupiah bulat per invoice lunas. */
  readonly fixedAmount: number | null;
}

/**
 * Komisi rupiah bulat (dibulatkan ke bawah) dari DPP. Invoice ber-DPP nol
 * (mis. tagihan Rp0 karena potongan penuh) tidak berkomisi, termasuk untuk
 * aturan nominal tetap.
 */
export function calculateCommissionAmount(
  rule: CommissionRate,
  baseAmount: number,
): number {
  if (baseAmount <= 0) return 0;
  if (rule.type === "PERCENTAGE") {
    return Math.floor((baseAmount * (rule.rate ?? 0)) / PERCENT_DIVISOR);
  }
  return rule.fixedAmount ?? 0;
}
