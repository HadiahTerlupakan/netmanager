import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { SupportTicketService } from "@/modules/pelanggan";
import { parsePaginationParams } from "@/lib/constants/pagination";
import { z } from "zod";

const ticketService = new SupportTicketService();

const createTicketSchema = z.object({
  category: z.string().min(1, "Kategori wajib diisi"),
  subject: z.string().min(1, "Subjek wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

/**
 * GET /api/customer/tickets
 * Get customer's support tickets
 */
export const GET = createHandler(
  { auth: true, permissions: ["tickets:read"] },
  async (req, ctx) => {
    const session = ctx.session!;
    const { searchParams } = req.nextUrl;

    const { page, limit } = parsePaginationParams(searchParams);
    const status = searchParams.get("status") || undefined;

    const result = await ticketService.getCustomerTickets(
      session.user.id,
      page,
      limit,
      status,
    );

    return apiSuccess(result);
  },
);

/**
 * POST /api/customer/tickets
 * Create new support ticket
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["tickets:create"],
    schema: createTicketSchema,
  },
  async (_req, ctx) => {
    const session = ctx.session!;
    const body = ctx.validated;

    try {
      const ticket = await ticketService.createTicket(session.user.id, {
        category: body.category,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
      });

      return apiSuccess(
        { ticket },
        { status: 201, message: "Tiket berhasil dibuat" },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Gagal membuat tiket";

      // Map validation errors to 400
      const validationErrors = [
        "Kategori, subjek, dan deskripsi wajib diisi",
        "Kategori tidak valid",
      ];

      if (validationErrors.includes(message)) {
        return ApiErrors.badRequest(message);
      }

      throw error; // Let createHandler handle general errors
    }
  },
);
