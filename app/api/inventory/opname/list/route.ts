import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getInventoryOpnameService,
  OPNAME_REASON_CODES,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { parsePaginationParams } from "@/lib/utils/pagination";

const ALLOWED_REASONS = new Set<string>(OPNAME_REASON_CODES);

function readReasonParam(value: string | null) {
  if (!value) return undefined;
  return ALLOWED_REASONS.has(value) ? value : undefined;
}

/**
 * GET /api/inventory/opname/list
 * Get all stock opname records with filters and pagination
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
    const { page, limit } = parsePaginationParams(searchParams, {
      page: 1,
      limit: 20,
    });

    const opnameService = getInventoryOpnameService();
    const dbStart = Date.now();
    const result = await opnameService.listOpname({
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
      page,
      limit,
    });

    logger.dbOperation(
      "findMany",
      "StockOpname+Relations",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/opname/list",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.opnameList.length,
        page,
        limit,
        total: result.pagination.total,
        barangId,
        gudangId,
        tanggalMulai,
        tanggalSelesai,
        alasanSelisih,
      },
    );

    return apiSuccess({
      opnameList: result.opnameList,
      pagination: {
        page,
        limit,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error fetching stock opname list", err, {
      path: "/api/inventory/opname/list",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data stock opname");
  }
});
