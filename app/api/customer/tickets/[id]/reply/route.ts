import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { SupportTicketService } from "@/modules/pelanggan";
import { z } from "zod";
import { NextRequest } from "next/server";

const ticketService = new SupportTicketService();

const replyTicketSchema = z.object({
  message: z.string().min(1, "Pesan tidak boleh kosong"),
  attachments: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/customer/tickets/[id]/reply
 * Customer replies to ticket
 */
export async function POST(request: NextRequest, routeContext: RouteParams) {
  const handler = createHandler(
    {
      auth: true,
      permissions: ["tickets:update"],
      schema: replyTicketSchema,
    },
    async (_req, ctx) => {
      const session = ctx.session!;
      const { id } = await routeContext.params;
      const body = ctx.validated;

      try {
        const result = await ticketService.replyToCustomerTicket(
          session.user.id,
          id,
          {
            message: body.message,
            attachments: body.attachments,
          },
        );

        return apiSuccess(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Gagal mengirim balasan";

        if (message === "Tiket tidak ditemukan") {
          return ApiErrors.notFound(message);
        }
        if (
          message.includes("tidak boleh kosong") ||
          message.includes("sudah ditutup")
        ) {
          return ApiErrors.badRequest(message);
        }

        throw error;
      }
    },
  );

  return handler(request, routeContext);
}
