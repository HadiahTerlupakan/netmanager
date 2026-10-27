import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { SupportTicketService } from "@/modules/pelanggan";
import {
  customerTicketErrorResponse,
  customerTicketSuccess,
  parseCustomerTicketBody,
  type TicketRouteParams,
} from "../../route-helpers";

const ticketService = new SupportTicketService();

// Body opsional: pelanggan boleh menutup tiket tanpa rating maupun feedback.
const closeTicketSchema = z
  .object({
    feedback: z.string().optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .optional();

/**
 * POST /api/customer/tickets/[id]/close
 * Pelanggan menutup tiket miliknya sendiri.
 */
export async function POST(
  request: NextRequest,
  { params }: TicketRouteParams,
) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const body = await parseCustomerTicketBody(request, closeTicketSchema);
  if (body.response) return body.response;

  const { id } = await params;

  try {
    const result = await ticketService.closeCustomerTicket(
      auth.session.id,
      id,
      body.data ?? {},
    );
    return customerTicketSuccess(result);
  } catch (error) {
    return customerTicketErrorResponse(error, "POST close");
  }
}
