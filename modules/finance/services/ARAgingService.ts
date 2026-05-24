import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import {
  getARAgingSnapshotRepository,
  type ARAgingSnapshotEntity,
} from "../repositories/ARAgingSnapshotRepository";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ARAgingBuckets {
  current: bigint;
  overdue30: bigint;
  overdue60: bigint;
  overdue90: bigint;
  totalOutstanding: bigint;
  totalCustomers: number;
}

export interface ARAgingCustomerBreakdown {
  pelangganId: string;
  current: bigint;
  overdue30: bigint;
  overdue60: bigint;
  overdue90: bigint;
  total: bigint;
  invoiceCount: number;
  oldestDueDate: Date;
}

export interface ARAgingComputeResult extends ARAgingBuckets {
  snapshotId: string;
  snapshotDate: Date;
  invoiceCount: number;
}

interface UnpaidInvoiceRow {
  pelangganId: string;
  dueDate: Date;
  totalAmount: bigint;
  paidAmount: bigint;
}

/**
 * Compute & save AR aging snapshot.
 *
 * Aging buckets (per outstanding amount, bukan total invoice):
 * - current: belum jatuh tempo (dueDate >= today)
 * - overdue30: 1-30 hari lewat dueDate
 * - overdue60: 31-60 hari lewat dueDate
 * - overdue90: 61+ hari lewat dueDate
 */
export class ARAgingService {
  constructor(private readonly repo = getARAgingSnapshotRepository()) {}

  /** Hitung aging dari Invoice unpaid + simpan snapshot. */
  async computeAndSave(now = new Date()): Promise<ARAgingComputeResult> {
    const invoices = await this.fetchUnpaidInvoices();
    const buckets = this.computeBuckets(invoices, now);

    const snapshot = await this.repo.save({
      current: buckets.current,
      overdue30: buckets.overdue30,
      overdue60: buckets.overdue60,
      overdue90: buckets.overdue90,
      totalOutstanding: buckets.totalOutstanding,
      totalCustomers: buckets.totalCustomers,
    });

    logger.info(
      `[ARAging] Snapshot saved: ${invoices.length} invoices, ` +
        `total ${buckets.totalOutstanding}, customers ${buckets.totalCustomers}`,
    );

    return {
      snapshotId: snapshot.id,
      snapshotDate: snapshot.snapshotDate,
      invoiceCount: invoices.length,
      ...buckets,
    };
  }

  /** Ambil snapshot terbaru tanpa recompute. */
  async getLatestSnapshot(
    tenantId?: string | null,
  ): Promise<ARAgingSnapshotEntity | null> {
    return this.repo.findLatest(tenantId);
  }

  /** Ambil history untuk trend chart. */
  async getHistory(
    days = 30,
    tenantId?: string | null,
  ): Promise<ARAgingSnapshotEntity[]> {
    return this.repo.findRange(days, tenantId);
  }

  /**
   * Drill-down breakdown per pelanggan dari aging realtime
   * (recompute, bukan dari snapshot).
   */
  async getCustomerBreakdown(
    now = new Date(),
  ): Promise<ARAgingCustomerBreakdown[]> {
    const invoices = await this.fetchUnpaidInvoices();
    return this.aggregatePerCustomer(invoices, now);
  }

  private async fetchUnpaidInvoices(): Promise<UnpaidInvoiceRow[]> {
    const rows = await prismaBilling.invoice.findMany({
      where: {
        status: { notIn: ["PAID", "CANCELLED"] },
      },
      select: {
        pelangganId: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
      },
    });

    return rows.filter((row) => row.totalAmount - row.paidAmount > 0n);
  }

  private computeBuckets(
    invoices: UnpaidInvoiceRow[],
    now: Date,
  ): ARAgingBuckets {
    let current = 0n;
    let overdue30 = 0n;
    let overdue60 = 0n;
    let overdue90 = 0n;
    const customerSet = new Set<string>();

    for (const inv of invoices) {
      const outstanding = inv.totalAmount - inv.paidAmount;
      if (outstanding <= 0n) continue;

      customerSet.add(inv.pelangganId);
      const bucket = bucketOf(inv.dueDate, now);

      if (bucket === "current") current += outstanding;
      else if (bucket === "overdue30") overdue30 += outstanding;
      else if (bucket === "overdue60") overdue60 += outstanding;
      else overdue90 += outstanding;
    }

    return {
      current,
      overdue30,
      overdue60,
      overdue90,
      totalOutstanding: current + overdue30 + overdue60 + overdue90,
      totalCustomers: customerSet.size,
    };
  }

  private aggregatePerCustomer(
    invoices: UnpaidInvoiceRow[],
    now: Date,
  ): ARAgingCustomerBreakdown[] {
    const map = new Map<string, ARAgingCustomerBreakdown>();

    for (const inv of invoices) {
      const outstanding = inv.totalAmount - inv.paidAmount;
      if (outstanding <= 0n) continue;

      const existing = map.get(inv.pelangganId) ?? {
        pelangganId: inv.pelangganId,
        current: 0n,
        overdue30: 0n,
        overdue60: 0n,
        overdue90: 0n,
        total: 0n,
        invoiceCount: 0,
        oldestDueDate: inv.dueDate,
      };

      const bucket = bucketOf(inv.dueDate, now);
      if (bucket === "current") existing.current += outstanding;
      else if (bucket === "overdue30") existing.overdue30 += outstanding;
      else if (bucket === "overdue60") existing.overdue60 += outstanding;
      else existing.overdue90 += outstanding;

      existing.total += outstanding;
      existing.invoiceCount += 1;
      if (inv.dueDate < existing.oldestDueDate) {
        existing.oldestDueDate = inv.dueDate;
      }

      map.set(inv.pelangganId, existing);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.total > b.total ? -1 : a.total < b.total ? 1 : 0,
    );
  }
}

function bucketOf(
  dueDate: Date,
  now: Date,
): "current" | "overdue30" | "overdue60" | "overdue90" {
  const ageDays = Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY);
  if (ageDays <= 0) return "current";
  if (ageDays <= 30) return "overdue30";
  if (ageDays <= 60) return "overdue60";
  return "overdue90";
}

let serviceInstance: ARAgingService | null = null;

export function getARAgingService(): ARAgingService {
  serviceInstance ??= new ARAgingService();
  return serviceInstance;
}
