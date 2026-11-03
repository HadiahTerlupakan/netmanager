import type { PaidInvoiceAmounts } from "./ports/IInvoicePaymentStatusReader";
import type { ResellerCommissionTypeValue } from "./entities/ResellerCommissionEntity";

/** Persen disimpan hingga 2 desimal → 1% = 100 basis poin. */
const BASIS_POINTS_PER_PERCENT = 100;
const BASIS_POINTS_DIVISOR = 10_000;

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
  /** Persen 0–100 hingga 2 desimal (kolom `rate` Decimal(5,2)), mis. 2.5. */
  readonly rate: number | null;
  /** Rupiah bulat per invoice lunas. */
  readonly fixedAmount: number | null;
}

/**
 * Persen (hingga 2 desimal) menjadi basis poin bulat: 2.5 → 250. Pembulatan
 * menyerap galat biner float (mis. 2.55 * 100 = 254.99999999999997).
 */
export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * BASIS_POINTS_PER_PERCENT);
}

/**
 * Komisi rupiah bulat (dibulatkan ke bawah) dari DPP. Persen dihitung lewat
 * basis poin bulat agar perkaliannya eksak di aritmetika integer (tanpa galat
 * float pada persen desimal). Invoice ber-DPP nol (mis. tagihan Rp0 karena
 * potongan penuh) tidak berkomisi, termasuk untuk aturan nominal tetap.
 */
export function calculateCommissionAmount(
  rule: CommissionRate,
  baseAmount: number,
): number {
  if (baseAmount <= 0) return 0;
  if (rule.type === "PERCENTAGE") {
    const basisPoints = percentToBasisPoints(rule.rate ?? 0);
    return Math.floor((baseAmount * basisPoints) / BASIS_POINTS_DIVISOR);
  }
  return rule.fixedAmount ?? 0;
}
