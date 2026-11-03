import type {
  ResellerMonthlyReport,
  ResellerReportFigures,
  ResellerReportRow,
} from "../domain/entities/ResellerReportEntity";
import type {
  IResellerBillingReader,
  IResellerReportRepository,
  ReportAdjustmentTotal,
  ReportCommissionTotal,
  ReportCustomer,
  ReportInvoiceTotal,
  ReportOutlet,
} from "../domain/ports/IResellerReportSources";
import { ResellerNotFoundError } from "../errors/reseller-errors";
import { ResellerReportRepository } from "../repositories/ResellerReportRepository";
import { FinanceResellerBillingReader } from "./finance-billing-reader";

const DIRECT_OUTLET_LABEL = "Langsung (tanpa outlet)";
const ZERO_FIGURES: ResellerReportFigures = {
  activeCustomers: 0,
  grossBilled: 0,
  paid: 0,
  commissionAccrued: 0,
  commissionSettled: 0,
  commissionPaid: 0,
  commissionAdjusted: 0,
};
const PAID_LIKE_STATUSES: ReadonlySet<ReportCommissionTotal["status"]> =
  new Set(["PAID", "REVERSED"]);

/** Rentang UTC satu bulan `YYYY-MM`, sama dengan `ResellerCommission.period`. */
export function toPeriodRange(period: string): {
  periodStart: Date;
  periodEnd: Date;
} {
  const [year, month] = period.split("-").map(Number);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1) - 1);
  return { periodStart, periodEnd };
}

/**
 * Laporan bulanan reseller per outlet: pelanggan aktif, tagihan bruto,
 * terbayar, komisi (terbit/settle/dibayar), dan koreksi komisi. Bukti bahwa seluruh tagihan
 * pelanggan reseller dibukukan ISP (model agen), dan imbalan reseller tercatat
 * sebagai komisi.
 *
 * Pelanggan dikelompokkan menurut reseller/outlet SAAT INI; riwayat
 * perpindahan outlet tidak tersimpan. Komisi pelanggan yang sudah pindah dari
 * reseller ini tetap dihitung di baris "Langsung" agar total komisi reseller
 * tetap utuh.
 */
export class ResellerReportService {
  constructor(
    private readonly repository: IResellerReportRepository = new ResellerReportRepository(),
    private readonly billing: IResellerBillingReader = new FinanceResellerBillingReader(),
  ) {}

  /**
   * Laporan bulanan satu reseller.
   *
   * @throws ResellerNotFoundError reseller tidak ada di tenant.
   */
  async getMonthlyReport(
    tenantId: string,
    resellerId: string,
    period: string,
  ): Promise<ResellerMonthlyReport> {
    const reseller = await this.repository.findReseller(tenantId, resellerId);
    if (!reseller) throw new ResellerNotFoundError();

    const periodRange = toPeriodRange(period);
    const [outlets, customers, commissions, adjustments] = await Promise.all([
      this.repository.findOutlets(tenantId, resellerId),
      this.repository.findCustomers(tenantId, resellerId),
      this.repository.sumCommissions(tenantId, resellerId, period),
      this.repository.sumAdjustments({ tenantId, resellerId, ...periodRange }),
    ]);
    const invoices =
      customers.length > 0
        ? await this.billing.summarizeInvoices({
            tenantId,
            pelangganIds: customers.map((customer) => customer.id),
            ...periodRange,
          })
        : [];

    const rows = buildRows({
      outlets,
      customers,
      commissions,
      adjustments,
      invoices,
    });
    return {
      resellerId: reseller.id,
      resellerCode: reseller.code,
      resellerName: reseller.name,
      period,
      rows,
      totals: rows.reduce(addFigures, ZERO_FIGURES),
    };
  }
}

function buildRows(sources: {
  readonly outlets: readonly ReportOutlet[];
  readonly customers: readonly ReportCustomer[];
  readonly commissions: readonly ReportCommissionTotal[];
  readonly adjustments: readonly ReportAdjustmentTotal[];
  readonly invoices: readonly ReportInvoiceTotal[];
}): ResellerReportRow[] {
  const outletOfCustomer = new Map(
    sources.customers.map((customer) => [customer.id, customer.outletId]),
  );
  const figures = new Map<string | null, ResellerReportFigures>();
  const add = (
    outletId: string | null,
    delta: Partial<ResellerReportFigures>,
  ) =>
    figures.set(
      outletId,
      addFigures(figures.get(outletId) ?? ZERO_FIGURES, {
        ...ZERO_FIGURES,
        ...delta,
      }),
    );

  for (const customer of sources.customers) {
    add(customer.outletId, { activeCustomers: customer.isActive ? 1 : 0 });
  }
  for (const invoice of sources.invoices) {
    add(outletOfCustomer.get(invoice.pelangganId) ?? null, {
      grossBilled: invoice.grossBilled,
      paid: invoice.paid,
    });
  }
  for (const commission of sources.commissions) {
    add(
      outletOfCustomer.get(commission.pelangganId) ?? null,
      commissionFigures(commission),
    );
  }
  for (const adjustment of sources.adjustments) {
    add(outletOfCustomer.get(adjustment.pelangganId) ?? null, {
      commissionAdjusted: adjustment.amount,
    });
  }
  return toRows(figures, sources.outlets);
}

function commissionFigures(
  commission: ReportCommissionTotal,
): Partial<ResellerReportFigures> {
  // REVERSED pernah disettle dan dibayar; tagih baliknya di `commissionAdjusted`.
  const isPaid = PAID_LIKE_STATUSES.has(commission.status);
  const isSettled = isPaid || commission.status === "SETTLED";
  return {
    commissionAccrued: commission.amount,
    commissionSettled: isSettled ? commission.amount : 0,
    commissionPaid: isPaid ? commission.amount : 0,
  };
}

/**
 * Outlet tanpa data tetap tampil. Baris "Langsung" (tanpa outlet, outlet tak
 * dikenal, atau pelanggan yang sudah pindah) hanya ada bila ada isinya.
 */
function toRows(
  figures: Map<string | null, ResellerReportFigures>,
  outlets: readonly ReportOutlet[],
): ResellerReportRow[] {
  const knownOutletIds = new Set(outlets.map((outlet) => outlet.id));
  const directFigures = [...figures]
    .filter(([outletId]) => outletId === null || !knownOutletIds.has(outletId))
    .map(([, value]) => value);
  const outletRows = outlets.map((outlet) => ({
    outletId: outlet.id,
    outletCode: outlet.code,
    outletName: outlet.name,
    ...(figures.get(outlet.id) ?? ZERO_FIGURES),
  }));
  if (directFigures.length === 0) return outletRows;
  const directRow: ResellerReportRow = {
    outletId: null,
    outletCode: null,
    outletName: DIRECT_OUTLET_LABEL,
    ...directFigures.reduce(addFigures, ZERO_FIGURES),
  };
  return [directRow, ...outletRows];
}

function addFigures(
  left: ResellerReportFigures,
  right: ResellerReportFigures,
): ResellerReportFigures {
  return {
    activeCustomers: left.activeCustomers + right.activeCustomers,
    grossBilled: left.grossBilled + right.grossBilled,
    paid: left.paid + right.paid,
    commissionAccrued: left.commissionAccrued + right.commissionAccrued,
    commissionSettled: left.commissionSettled + right.commissionSettled,
    commissionPaid: left.commissionPaid + right.commissionPaid,
    commissionAdjusted: left.commissionAdjusted + right.commissionAdjusted,
  };
}

let resellerReportService: ResellerReportService | null = null;

/** Get singleton reseller report service. */
export function getResellerReportService(): ResellerReportService {
  if (!resellerReportService)
    resellerReportService = new ResellerReportService();
  return resellerReportService;
}
