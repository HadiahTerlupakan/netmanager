import { logger } from "@/lib/logger";
import { ensureAdminAccess } from "@/lib/server-auth";
import { prisma } from "@/modules/database";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

/** GET /api/admin/notifications/dead-letter — daftar DLQ notifikasi dengan filter & pagination. */
export async function GET(request: Request) {
  try {
    await ensureAdminAccess();

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel"); // inApp | push | whatsapp | email
    const pelangganId = searchParams.get("pelangganId");
    const resolved = searchParams.get("resolved") === "true"; // default: false (unresolved)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      resolvedAt: resolved ? { not: null } : null,
    };
    if (channel) where.channel = channel;
    if (pelangganId) where.pelangganId = pelangganId;

    const [items, total] = await Promise.all([
      prisma.notificationDeadLetter.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.notificationDeadLetter.count({ where }),
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
    logger.error("[API] Error fetching dead letter queue:", error);
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    return ApiErrors.internalError("Gagal mengambil data dead letter queue");
  }
}
