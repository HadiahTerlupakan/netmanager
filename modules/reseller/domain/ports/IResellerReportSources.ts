export interface ReportReseller {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ReportOutlet {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ReportCustomer {
  readonly id: string;
  readonly outletId: string | null;
  readonly isActive: boolean;
}

/** Komisi satu pelanggan per status pada periode laporan. */
export interface ReportCommissionTotal {
  readonly pelangganId: string;
  readonly status: "ACCRUED" | "SETTLED" | "PAID";
  readonly amount: number;
}

/** Tagihan satu pelanggan pada periode laporan. */
export interface ReportInvoiceTotal {
  readonly pelangganId: string;
  readonly grossBilled: number;
  readonly paid: number;
}

/** Data reseller untuk laporan (database utama), selalu dibatasi tenant. */
export interface IResellerReportRepository {
  findReseller(
    tenantId: string,
    resellerId: string,
  ): Promise<ReportReseller | null>;
  /** Semua outlet reseller, termasuk yang sudah dihapus (untuk label). */
  findOutlets(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ReportOutlet[]>;
  /** Pelanggan yang saat ini dikaitkan ke reseller. */
  findCustomers(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ReportCustomer[]>;
  /** Komisi reseller yang terbit di `period` (YYYY-MM), per pelanggan & status. */
  sumCommissions(
    tenantId: string,
    resellerId: string,
    period: string,
  ): Promise<readonly ReportCommissionTotal[]>;
}

/** Tagihan pelanggan dari modul finance (database billing). */
export interface IResellerBillingReader {
  summarizeInvoices(params: {
    readonly tenantId: string;
    readonly pelangganIds: readonly string[];
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }): Promise<readonly ReportInvoiceTotal[]>;
}
