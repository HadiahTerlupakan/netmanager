import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { SupportTicketService } from "@/modules/pelanggan";
import { NextRequest } from "next/server";

const ticketService = new SupportTicketService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customer/tickets/[id]
 * Get ticket detail with replies
 */
export async function GET(request: NextRequest, routeContext: RouteParams) {
  const handler = createHandler(
    { auth: true, permissions: ["tickets:read"] },
    async (_req, ctx) => {
      const session = ctx.session!;
      const { id } = await routeContext.params;

      try {
        const ticket = await ticketService.getCustomerTicketDetail(
          session.user.id,
          id,
        );
        return apiSuccess({ ticket });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Gagal mengambil detail tiket";

        if (message === "Tiket tidak ditemukan") {
          return ApiErrors.notFound(message);
        }

        throw error;
      }
    },
  );

  return handler(request, routeContext);
}
