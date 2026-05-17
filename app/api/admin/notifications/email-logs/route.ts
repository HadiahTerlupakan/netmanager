import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  listEmailDeliveryLogs,
  normalizeEmailLogPage,
  normalizeEmailLogLimit,
  EmailLogSearchTooLongError,
} from "@/modules/notification";

/** GET /api/admin/notifications/email-logs — daftar log pengiriman email dengan filter & pagination. */
export const GET = createHandler(
  { auth: true, permissions: ["notifications:read"] },
  async (request: NextRequest, ctx) => {
    const isSuperAdmin = ctx.session!.user.isSuperAdmin === true;
    const tenantId = ctx.session!.user.tenantId ?? null;

    if (!isSuperAdmin && !tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const { searchParams } = new URL(request.url);

    try {
      const result = await listEmailDeliveryLogs({
        isSuperAdmin,
        tenantId,
        status: searchParams.get("status"),
        search: searchParams.get("search"),
        page: normalizeEmailLogPage(searchParams.get("page")),
        limit: normalizeEmailLogLimit(searchParams.get("limit")),
      });
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof EmailLogSearchTooLongError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
