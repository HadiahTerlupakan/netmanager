import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";

/** Status email yang valid untuk filter. */
const VALID_EMAIL_STATUSES = new Set(["PENDING", "SENT", "FAILED", "BOUNCED"]);

/** GET /api/admin/notifications/email-logs — daftar log pengiriman email dengan filter & pagination. */
export const GET = createHandler(
  { auth: true, permissions: ["notifications:read"] },
  async (request: NextRequest, ctx) => {
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const searchParam = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
    );
    const skip = (page - 1) * limit;

    // Validasi search — max 255 karakter
    if (searchParam && searchParam.length > 255) {
      return ApiErrors.badRequest("Search query terlalu panjang");
    }

    // Validasi status — value invalid diabaikan
    const status =
      statusParam && VALID_EMAIL_STATUSES.has(statusParam) ? statusParam : null;

    const where: Record<string, unknown> = {
      ...(!isSuperAdmin ? { tenantId } : {}),
    };
    if (status) where.status = status;
    if (searchParam) where.to = { contains: searchParam, mode: "insensitive" };

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
  },
);
