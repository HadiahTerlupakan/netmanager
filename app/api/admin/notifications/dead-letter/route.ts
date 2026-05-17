import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  listNotificationDeadLetters,
  normalizeDeadLetterPage,
  normalizeDeadLetterLimit,
} from "@/modules/notification";

/** GET /api/admin/notifications/dead-letter — daftar DLQ notifikasi dengan filter & pagination. */
export const GET = createHandler(
  { auth: true, permissions: ["notifications:read"] },
  async (request: NextRequest, ctx) => {
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId ?? null;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const { searchParams } = new URL(request.url);
    const result = await listNotificationDeadLetters({
      isSuperAdmin,
      tenantId,
      channel: searchParams.get("channel"),
      pelangganId: searchParams.get("pelangganId"),
      resolved: searchParams.get("resolved") === "true",
      page: normalizeDeadLetterPage(searchParams.get("page")),
      limit: normalizeDeadLetterLimit(searchParams.get("limit")),
    });

    return apiSuccess(result);
  },
);
