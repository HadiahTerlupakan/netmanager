import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getARAgingService } from "@/modules/finance";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/finance/ar-aging
 * Query params:
 * - history=<days> : ambil snapshot history N hari terakhir (default 30)
 * - breakdown=true : ambil breakdown per pelanggan realtime (untuk drill-down)
 * - recompute=true : force compute ulang dari Invoice (skip snapshot terbaru)
 */
export const GET = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("finance:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat AR aging",
    );
  }

  try {
    const url = req.nextUrl;
    const historyDays = Number(url.searchParams.get("history") ?? 30);
    const wantsBreakdown = url.searchParams.get("breakdown") === "true";
    const wantsRecompute = url.searchParams.get("recompute") === "true";

    const service = getARAgingService();

    const latest = wantsRecompute
      ? await service.computeAndSave()
      : ((await service.getLatestSnapshot()) ??
        (await service.computeAndSave()));

    const history = await service.getHistory(historyDays);
    const breakdown = wantsBreakdown
      ? await service.getCustomerBreakdown()
      : null;

    return apiSuccess({
      latest: serialize(latest),
      history: history.map(serialize),
      breakdown: breakdown
        ? breakdown.map((row) => ({
            pelangganId: row.pelangganId,
            current: row.current.toString(),
            overdue30: row.overdue30.toString(),
            overdue60: row.overdue60.toString(),
            overdue90: row.overdue90.toString(),
            total: row.total.toString(),
            invoiceCount: row.invoiceCount,
            oldestDueDate: row.oldestDueDate.toISOString(),
          }))
        : null,
    });
  } catch (error: unknown) {
    logger.error("[Admin AR Aging] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil data AR aging",
    );
  }
});

function serialize<
  T extends {
    current: bigint;
    overdue30: bigint;
    overdue60: bigint;
    overdue90: bigint;
    totalOutstanding: bigint;
    snapshotDate: Date;
  },
>(snapshot: T) {
  return {
    ...snapshot,
    current: snapshot.current.toString(),
    overdue30: snapshot.overdue30.toString(),
    overdue60: snapshot.overdue60.toString(),
    overdue90: snapshot.overdue90.toString(),
    totalOutstanding: snapshot.totalOutstanding.toString(),
    snapshotDate: snapshot.snapshotDate.toISOString(),
  };
}
