import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";

/** Daftar channel yang valid untuk filter DLQ. */
const VALID_CHANNELS = new Set(["inApp", "push", "whatsapp", "email"]);

/** GET /api/admin/notifications/dead-letter — daftar DLQ notifikasi dengan filter & pagination. */
export const GET = createHandler(
  { auth: true, permissions: ["notifications:read"] },
  async (request: NextRequest, ctx) => {
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const { searchParams } = new URL(request.url);
    const channelParam = searchParams.get("channel");
    const pelangganIdParam = searchParams.get("pelangganId");
    const resolved = searchParams.get("resolved") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );
    const skip = (page - 1) * limit;

    // Validasi channel — value invalid diabaikan (lenient)
    const channel =
      channelParam && VALID_CHANNELS.has(channelParam) ? channelParam : null;

    // Validasi pelangganId — max 100 karakter; jika lebih diabaikan
    const pelangganId =
      pelangganIdParam && pelangganIdParam.length <= 100
        ? pelangganIdParam
        : null;

    const where: Record<string, unknown> = {
      resolvedAt: resolved ? { not: null } : null,
      ...(!isSuperAdmin ? { tenantId } : {}),
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
  },
);
