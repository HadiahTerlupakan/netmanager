/** Angka satu baris laporan bulanan reseller (rupiah bulat). */
export interface ResellerReportFigures {
  /** Pelanggan reseller berstatus AKTIF saat laporan dibuat (bukan historis). */
  readonly activeCustomers: number;
  /** Total invoice terbit di periode (termasuk PPN), selain DRAFT/CANCELLED. */
  readonly grossBilled: number;
  /** Total invoice yang lunas (PAID) di periode. */
  readonly paid: number;
  /** Seluruh komisi yang terbit di periode. */
  readonly commissionAccrued: number;
  /** Bagian komisi periode itu yang sudah masuk settlement (SETTLED/PAID/REVERSED). */
  readonly commissionSettled: number;
  /** Bagian komisi periode itu yang sudah dibayar (PAID/REVERSED). */
  readonly commissionPaid: number;
  /**
   * Koreksi (clawback) yang dicatat di periode ini atas komisi yang sudah
   * dibayar, apa pun periode komisinya. Bulan koreksi sama dengan tanggal
   * jurnal pembaliknya.
   */
  readonly commissionAdjusted: number;
}

/** Baris per outlet; outlet null = pelanggan langsung reseller tanpa outlet. */
export interface ResellerReportRow extends ResellerReportFigures {
  readonly outletId: string | null;
  readonly outletCode: string | null;
  readonly outletName: string;
}

/** Laporan bulanan satu reseller, dirinci per outlet. */
export interface ResellerMonthlyReport {
  readonly resellerId: string;
  readonly resellerCode: string;
  readonly resellerName: string;
  /** YYYY-MM (UTC, sama dengan `ResellerCommission.period`). */
  readonly period: string;
  readonly rows: readonly ResellerReportRow[];
  readonly totals: ResellerReportFigures;
}
