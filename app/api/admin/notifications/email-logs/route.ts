import { logger } from "@/lib/logger";
import { ensureAdminAccess } from "@/lib/server-auth";
import { prisma } from "@/modules/database";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

/** GET /api/admin/notifications/email-logs — daftar log pengiriman email dengan filter & pagination. */
export async function GET(request: Request) {
  try {
    await ensureAdminAccess();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // PENDING | SENT | FAILED | BOUNCED
    const search = searchParams.get("search"); // filter by email tujuan
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) where.to = { contains: search, mode: "insensitive" };

    const [items, total] = await Promise.all([
      prisma.emailDeliveryLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.emailDeliveryLog.count({ where }),
    ]);

    return apiSuccess({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    logger.error("[API] Error fetching email delivery logs:", error);
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    return ApiErrors.internalError("Gagal mengambil log pengiriman email");
  }
}
