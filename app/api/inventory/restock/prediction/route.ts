import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const inventoryRouteService = getInventoryRouteService();

/**
 * GET /api/inventory/restock/prediction
 * Generate restock predictions
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/restock/prediction",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    if (!(await hasPermission("restock:read"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat prediksi restock",
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const gudangId = searchParams.get("gudangId");
    const days = parseInt(searchParams.get("days") || "90");
    const dbStart = Date.now();
    const result = await inventoryRouteService.getRestockPredictions({
      gudangId: gudangId || undefined,
      days,
    });

    logger.dbOperation(
      "complex",
      "RestockPrediction+Analytics",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/restock/prediction",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        predictionsCount: result.predictions.length,
        days,
        gudangId,
      },
    );

    return apiSuccess({
      predictions: result.predictions,
      summary: result.summary,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error generating restock predictions", err, {
      path: "/api/inventory/restock/prediction",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal membuat prediksi restock");
  }
}
