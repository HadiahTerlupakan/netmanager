import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { getInventoryOpnameService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const inventoryOpnameService = getInventoryOpnameService();

async function requireAdmin() {
  const session = await getServerSession(authConfig);
  if (!session || false) {
    return null;
  }
  return session;
}

/**
 * GET /api/inventory/opname/list
 * Get all stock opname records with filters and pagination
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await requireAdmin();
    if (!session) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/opname/list",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("opname:read"))) {
      return ApiErrors.forbidden("Akses ditolak");
    }

    const searchParams = req.nextUrl.searchParams;
    const barangId = searchParams.get("barangId") || undefined;
    const gudangId = searchParams.get("gudangId") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const dbStart = Date.now();
    const result = await inventoryOpnameService.listOpname({
      user: {
        id: session.user.id,
        role: session.user.role,
        siteId: session.user.siteId,
      },
      barangId,
      gudangId,
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
        userId: session.user.id,
        count: result.opnameList.length,
        page,
        limit,
        total: result.pagination.total,
        barangId,
        gudangId,
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
}
