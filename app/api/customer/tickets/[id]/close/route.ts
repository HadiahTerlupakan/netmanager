import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { SupportTicketService } from "@/modules/pelanggan";
import { NextRequest } from "next/server";

const ticketService = new SupportTicketService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/customer/tickets/[id]/close
 * Customer closes their own ticket
 */
export async function POST(request: NextRequest, routeContext: RouteParams) {
  const handler = createHandler(
    {
      auth: true,
      permissions: ["tickets:update"],
    },
    async (req, ctx) => {
      const session = ctx.session!;
      const { id } = await routeContext.params;

      let body: { feedback?: string; rating?: number } = {};
      try {
        body = await req.json();
      } catch {
        // Body is optional
      }

      try {
        const result = await ticketService.closeCustomerTicket(
          session.user.id,
          id,
          {
            feedback: body.feedback,
            rating: body.rating,
          },
        );

        return apiSuccess(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Gagal menutup tiket";

        if (message === "Tiket tidak ditemukan") {
          return ApiErrors.notFound(message);
        }
        if (message.includes("akses")) {
          return ApiErrors.forbidden(message);
        }
        if (message.includes("sudah ditutup")) {
          return ApiErrors.badRequest(message);
        }

        throw error;
      }
    },
  );

  return handler(request, routeContext);
}
