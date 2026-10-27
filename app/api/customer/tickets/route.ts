import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { parsePaginationParams } from "@/lib/constants/pagination";
import { SupportTicketService } from "@/modules/pelanggan";
import {
  customerTicketErrorResponse,
  customerTicketSuccess,
  parseCustomerTicketBody,
} from "./route-helpers";

const ticketService = new SupportTicketService();

const createTicketSchema = z.object({
  category: z.string().min(1, "Kategori wajib diisi"),
  subject: z.string().min(1, "Subjek wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

/**
 * GET /api/customer/tickets
 * Daftar tiket milik pelanggan yang sedang login (sesi JWT portal).
 */
export async function GET(request: NextRequest) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { searchParams } = request.nextUrl;
  const { page, limit } = parsePaginationParams(searchParams);
  const status = searchParams.get("status") || undefined;

  try {
    const result = await ticketService.getCustomerTickets(
      auth.session.id,
      page,
      limit,
      status,
    );
    return customerTicketSuccess(result);
  } catch (error) {
    return customerTicketErrorResponse(error, "GET list");
  }
}

/**
 * POST /api/customer/tickets
 * Buat tiket baru atas nama pelanggan dari sesi.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const body = await parseCustomerTicketBody(request, createTicketSchema);
  if (body.response) return body.response;

  try {
    const ticket = await ticketService.createTicket(auth.session.id, body.data);
    return customerTicketSuccess(
      { message: "Tiket berhasil dibuat", ticket },
      201,
    );
  } catch (error) {
    return customerTicketErrorResponse(error, "POST create");
  }
}
