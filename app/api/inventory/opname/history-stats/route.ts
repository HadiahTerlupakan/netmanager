import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryOpnameService,
  OPNAME_REASON_CODES,
} from "@/modules/inventory";

const ALLOWED_REASONS = new Set<string>(OPNAME_REASON_CODES);

function readReasonParam(value: string | null) {
  if (!value) return undefined;
  return ALLOWED_REASONS.has(value) ? value : undefined;
}

/**
 * GET /api/inventory/opname/history-stats
 * Aggregate statistik Riwayat Opname (akurasi, total kondisi, hilang) sesuai filter.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const barangId = searchParams.get("barangId") || undefined;
    const gudangId = searchParams.get("gudangId") || undefined;
    const tanggalMulai = searchParams.get("tanggalMulai") || undefined;
    const tanggalSelesai = searchParams.get("tanggalSelesai") || undefined;
    const alasanSelisih = readReasonParam(searchParams.get("alasanSelisih"));

    const opnameService = getInventoryOpnameService();
    const dbStart = Date.now();
    const stats = await opnameService.getHistoryStats({
      user: {
        id: user.id,
        role: user.role,
        siteId: user.siteId,
      },
      barangId,
      gudangId,
      tanggalMulai,
      tanggalSelesai,
      alasanSelisih,
    });

    logger.dbOperation("aggregate", "StockOpname", Date.now() - dbStart);
    logger.apiRequest(
      "GET",
      "/api/inventory/opname/history-stats",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        totalRecords: stats.totalRecords,
        akurasiPercent: stats.akurasiPercent,
      },
    );

    return apiSuccess({ stats });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error fetching opname history stats", err, {
      path: "/api/inventory/opname/history-stats",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat statistik stock opname");
  }
});
