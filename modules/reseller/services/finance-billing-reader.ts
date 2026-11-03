import { FinanceRepositoryFacade } from "@/modules/finance";
import type {
  IResellerBillingReader,
  ReportInvoiceTotal,
} from "../domain/ports/IResellerReportSources";

/** Invoice yang tidak dihitung sebagai tagihan (belum terbit / dibatalkan). */
const EXCLUDED_BILLED_STATUSES = ["DRAFT", "CANCELLED"];
const PAID_STATUS = "PAID";
/** Batas jumlah id per query `IN` agar parameter query tidak meledak. */
const PELANGGAN_ID_CHUNK = 1000;

interface InvoiceRow {
  readonly pelangganId: string;
  readonly status: string;
  readonly totalAmount: bigint;
  readonly issueDate: Date;
  readonly paidAt: Date | null;
}

/**
 * Ringkasan tagihan pelanggan reseller lewat public API modul finance
 * (invoice ada di database billing, terpisah dari pelanggan). Tagihan bruto =
 * `totalAmount` invoice yang terbit di periode (sudah termasuk PPN); terbayar
 * = `totalAmount` invoice yang lunas di periode.
 */
export class FinanceResellerBillingReader implements IResellerBillingReader {
  /** Total tagihan & pelunasan per pelanggan pada periode. */
  async summarizeInvoices(params: {
    readonly tenantId: string;
    readonly pelangganIds: readonly string[];
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }): Promise<readonly ReportInvoiceTotal[]> {
    const totals = new Map<string, { grossBilled: number; paid: number }>();
    for (const chunk of chunkIds(params.pelangganIds)) {
      const rows = await this.findInvoices({ ...params, pelangganIds: chunk });
      for (const row of rows) accumulate(totals, row, params);
    }
    return [...totals].map(([pelangganId, total]) => ({
      pelangganId,
      ...total,
    }));
  }

  private async findInvoices(params: {
    readonly tenantId: string;
    readonly pelangganIds: readonly string[];
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }): Promise<readonly InvoiceRow[]> {
    const range = { gte: params.periodStart, lte: params.periodEnd };
    const rows =
      await FinanceRepositoryFacade.createInvoiceRepository().findMany(
        {
          tenantId: params.tenantId,
          pelangganId: { in: [...params.pelangganIds] },
          OR: [{ issueDate: range }, { status: PAID_STATUS, paidAt: range }],
        },
        {
          pelangganId: true,
          status: true,
          totalAmount: true,
          issueDate: true,
          paidAt: true,
        },
      );
    return rows as readonly InvoiceRow[];
  }
}

function chunkIds(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += PELANGGAN_ID_CHUNK) {
    chunks.push(ids.slice(index, index + PELANGGAN_ID_CHUNK));
  }
  return chunks;
}

function isWithin(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function accumulate(
  totals: Map<string, { grossBilled: number; paid: number }>,
  row: InvoiceRow,
  period: { readonly periodStart: Date; readonly periodEnd: Date },
): void {
  const total = totals.get(row.pelangganId) ?? { grossBilled: 0, paid: 0 };
  const amount = Number(row.totalAmount);
  const isBilled =
    !EXCLUDED_BILLED_STATUSES.includes(row.status) &&
    isWithin(row.issueDate, period.periodStart, period.periodEnd);
  const isPaid =
    row.status === PAID_STATUS &&
    isWithin(row.paidAt, period.periodStart, period.periodEnd);
  totals.set(row.pelangganId, {
    grossBilled: total.grossBilled + (isBilled ? amount : 0),
    paid: total.paid + (isPaid ? amount : 0),
  });
}
