import { hasPermission } from "@/lib/rbac";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger, logActivitySafe } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

const inventoryRouteService = getInventoryRouteService();

/**
 * GET /api/inventory/restock/alerts
 * Get all restock alerts
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat restock alerts",
    );
  }

  const { searchParams } = req.nextUrl;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const isRead = searchParams.get("isRead");
  const isResolved = searchParams.get("isResolved");
  const urgency = searchParams.get("urgency");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const dbStart = Date.now();

    const result = await inventoryRouteService.getRestockAlerts({
      barangId,
      gudangId,
      isRead: isRead !== null ? isRead === "true" : undefined,
      isResolved: isResolved !== null ? isResolved === "true" : undefined,
      urgency: urgency || undefined,
      page,
      limit,
    });

    logger.dbOperation(
      "findMany",
      "RestockAlerts+Relations",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "GET",
      "/api/inventory/restock/alerts",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.alerts.length,
        page,
        limit,
        total: result.pagination.total,
        unreadCount: result.unreadCount,
        barangId,
        gudangId,
        isRead,
        isResolved,
        urgency,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching restock alerts", err, {
      path: "/api/inventory/restock/alerts",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat notifikasi restock");
  }
});

/**
 * POST /api/inventory/restock/alerts
 * Create restock alert or check for alerts automatically
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat restock alerts",
    );
  }

  const body = await req.json();
  const { type = "AUTO_CHECK" } = body;

  try {
    const dbStart = Date.now();

    let result;

    if (type === "AUTO_CHECK") {
      result = await inventoryRouteService.autoCheckRestockAlerts();
    }

    logger.dbOperation(
      "transaction",
      "RestockAlerts+AutoCheck",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "POST",
      "/api/inventory/restock/alerts",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        type,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Restock Check",
      userId: user.id,
      details: { type, newAlertsCount: result?.newAlerts?.length || 0 },
    });

    return apiSuccess(result, { status: 201 });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error processing restock alerts", err, {
      path: "/api/inventory/restock/alerts",
      method: "POST",
    });

    return ApiErrors.internalError("Gagal memproses notifikasi restock");
  }
});
