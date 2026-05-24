import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getRevenueSnapshotService } from "@/modules/finance";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/finance/revenue-snapshot
 * Query params:
 * - history=<days>   : ambil snapshot history N hari terakhir (default 30)
 * - recompute=true   : force compute ulang snapshot hari ini
 */
export const GET = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("finance:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat revenue snapshot",
    );
  }

  try {
    const url = req.nextUrl;
    const historyDays = Number(url.searchParams.get("history") ?? 30);
    const wantsRecompute = url.searchParams.get("recompute") === "true";

    const service = getRevenueSnapshotService();

    const latest = wantsRecompute
      ? await service.computeAndSave()
      : ((await service.getLatest()) ?? (await service.computeAndSave()));

    const history = await service.getHistory(historyDays);

    return apiSuccess({
      latest: serialize(latest),
      history: history.map(serialize),
    });
  } catch (error: unknown) {
    logger.error("[Admin Revenue Snapshot] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error
        ? error.message
        : "Gagal mengambil data revenue snapshot",
    );
  }
});

function serialize<
  T extends {
    totalMRR: bigint;
    totalARR: bigint;
    newMRR: bigint;
    expansionMRR: bigint;
    contractionMRR: bigint;
    churnMRR: bigint;
    reactivationMRR: bigint;
    snapshotDate: Date;
  },
>(snapshot: T) {
  return {
    ...snapshot,
    totalMRR: snapshot.totalMRR.toString(),
    totalARR: snapshot.totalARR.toString(),
    newMRR: snapshot.newMRR.toString(),
    expansionMRR: snapshot.expansionMRR.toString(),
    contractionMRR: snapshot.contractionMRR.toString(),
    churnMRR: snapshot.churnMRR.toString(),
    reactivationMRR: snapshot.reactivationMRR.toString(),
    snapshotDate: snapshot.snapshotDate.toISOString(),
  };
}
