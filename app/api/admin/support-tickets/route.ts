import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getAdminSupportTicketService } from "@/modules/pelanggan";
import { supportTicketFilterSchema } from "@/lib/validations/support-ticket";
import { checkSiteRestriction } from "@/modules/roles";
import { logger } from "@/lib/logger";
import * as z from "zod";

/**
 * @swagger
 * /api/admin/support-tickets:
 *   get:
 *     summary: List support tickets
 *     description: Mengambil daftar tiket dukungan dengan pagination dan filter.
 *     tags: [Support Tickets]
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["support:read"],
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, query, permissions } = ctx;

    if (!session) return ApiErrors.unauthorized();

    // Validate query params with Zod
    // ctx.query already handles multi-value params and sanitization of "", "null", "undefined"
    const parseResult = supportTicketFilterSchema.safeParse(query);

    if (!parseResult.success) {
      return ApiErrors.badRequest(
        "Parameter tidak valid",
        z.flattenError(parseResult.error).fieldErrors,
      );
    }

    const validated = parseResult.data;

    // Site restriction logic
    const sessionWithPermissions = {
      ...session,
      user: {
        ...session.user,
        permissions,
      },
    };
    const { primarySiteId, isRestricted: hasSiteRestriction } =
      checkSiteRestriction(
        sessionWithPermissions as Parameters<typeof checkSiteRestriction>[0],
        "support",
      );

    // Build service filters
    const serviceFilters = {
      ...validated,
      siteId: primarySiteId,
    };

    const service = getAdminSupportTicketService();
    const result = await service.getTickets(
      serviceFilters,
      {
        id: session.user.id,
        role: session.user.role || "",
        siteId: primarySiteId,
      },
      hasSiteRestriction,
    );

    if (!result.success) {
      if (result.code === "FORBIDDEN") {
        return ApiErrors.forbidden(result.error || "Akses ditolak");
      }
      logger.error("[support-tickets] List failed", { error: result.error });
      return ApiErrors.internalError("Gagal mengambil data tiket");
    }

    const tickets = (result.data as { tickets?: unknown[] })?.tickets;
    logger.apiRequest(
      "GET",
      "/api/admin/support-tickets",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        count: tickets?.length || 0,
      },
    );

    return apiSuccess(result.data);
  },
);
