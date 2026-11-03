import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import type { ResellerCommissionAdjustmentEntity } from "../domain/entities/ResellerCommissionEntity";
import {
  allocateAdjustments,
  type AdjustmentAllocation,
  type AdjustmentDeduction,
} from "../domain/commission-adjustment";

/** Baris koreksi beserta aplikasinya, cukup untuk menghitung sisanya. */
export const ADJUSTMENT_WITH_APPLICATIONS = {
  applications: { select: { amount: true } },
} as const;

type AdjustmentRow = Prisma.ResellerCommissionAdjustmentGetPayload<{
  include: typeof ADJUSTMENT_WITH_APPLICATIONS;
}>;

interface ResellerScope {
  readonly tenantId: string | null;
  readonly resellerId: string;
}

/** Map baris koreksi ke entity, dengan sisa = amount - jumlah aplikasi. */
export function toAdjustmentEntity(
  row: AdjustmentRow,
): ResellerCommissionAdjustmentEntity {
  const applied = row.applications.reduce(
    (total, application) => total + application.amount,
    0,
  );
  return {
    id: row.id,
    tenantId: row.tenantId,
    resellerId: row.resellerId,
    pelangganId: row.pelangganId,
    invoiceId: row.invoiceId,
    sourceCommissionId: row.sourceCommissionId,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.createdAt,
    remainingAmount: Math.max(0, row.amount - applied),
  };
}

/**
 * Hitung potongan koreksi terbuka reseller atas komisi bruto settlement.
 * Wajib dipanggil setelah `lockResellerAdjustments` di transaksi yang sama.
 */
export async function planAdjustmentDeduction(
  tx: Prisma.TransactionClient,
  scope: ResellerScope,
  grossAmount: number,
): Promise<AdjustmentDeduction> {
  const rows = await tx.resellerCommissionAdjustment.findMany({
    where: { tenantId: scope.tenantId, resellerId: scope.resellerId },
    include: ADJUSTMENT_WITH_APPLICATIONS,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const open = rows
    .map(toAdjustmentEntity)
    .filter((adjustment) => adjustment.remainingAmount > 0);
  return allocateAdjustments(open, grossAmount);
}

/** Catat bagian koreksi yang dipotongkan pada settlement. */
export async function recordAdjustmentApplications(
  tx: Prisma.TransactionClient,
  target: { readonly tenantId: string | null; readonly settlementId: string },
  allocations: readonly AdjustmentAllocation[],
): Promise<void> {
  if (allocations.length === 0) return;
  await tx.resellerCommissionAdjustmentApplication.createMany({
    data: allocations.map((allocation) => ({
      id: randomUUID(),
      tenantId: target.tenantId,
      adjustmentId: allocation.adjustmentId,
      settlementId: target.settlementId,
      amount: allocation.amount,
    })),
  });
}
