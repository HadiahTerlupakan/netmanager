import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryRouteService,
  RESTOCK_MESSAGES,
  RestockSettingReferenceError,
  restockForbiddenMessage,
  restockServerErrorMessage,
} from "@/modules/inventory";
import { findRestockSettingsProblems } from "@/lib/validations/restock";
import { logActivitySafe } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

const inventoryRouteService = getInventoryRouteService();

/**
 * GET /api/inventory/restock/settings
 * Get all restock settings
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:read"));
  }

  const { searchParams } = req.nextUrl;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const dbStart = Date.now();

    const result = await inventoryRouteService.getRestockSettings({
      barangId,
      gudangId,
      page,
      limit,
    });

    logger.dbOperation(
      "findMany",
      "RestockSettings+Relations",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "GET",
      "/api/inventory/restock/settings",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.settings.length,
        page,
        limit,
        total: result.pagination.total,
        barangId,
        gudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching restock settings", err, {
      path: "/api/inventory/restock/settings",
      method: "GET",
    });
    return ApiErrors.internalError(
      restockServerErrorMessage("Memuat pengaturan restock", false),
    );
  }
});

/**
 * POST /api/inventory/restock/settings
 * Create or update restock settings
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:update"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:update"));
  }

  const body = await req.json().catch((): null => null);
  if (!body) return ApiErrors.badRequest(RESTOCK_MESSAGES.unreadableBody);
  const { barangId, gudangId, minStok, maxStok, safetyStok, leadTimeDays } =
    body;

  const problems = findRestockSettingsProblems(body);
  if (problems) return ApiErrors.badRequest(problems);

  try {
    const dbStart = Date.now();

    const result = await inventoryRouteService.saveRestockSettings({
      barangId,
      gudangId,
      minStok,
      maxStok,
      safetyStok,
      leadTimeDays,
    });

    logger.dbOperation(
      "transaction",
      "RestockSettings+Alerts",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "POST",
      "/api/inventory/restock/settings",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId,
        gudangId,
        minStok,
        maxStok,
      },
    );

    // System Log
    logActivitySafe({
      action: "UPDATE",
      subject: "Restock Settings",
      userId: user.id,
      details: { barangId, gudangId, minStok, maxStok },
    });

    return apiSuccess(
      {
        message: "Pengaturan restock berhasil disimpan",
        settings: result,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof RestockSettingReferenceError) {
      return error.reference === "barang"
        ? ApiErrors.notFound(error.message)
        : ApiErrors.badRequest(error.message);
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error saving restock settings", err, {
      path: "/api/inventory/restock/settings",
      method: "POST",
    });
    return ApiErrors.internalError(
      restockServerErrorMessage("Menyimpan pengaturan restock", false),
    );
  }
});
