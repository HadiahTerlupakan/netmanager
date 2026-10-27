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

// Pesan boleh kosong bila ada lampiran; aturan itu dijaga SupportTicketService.
const replyTicketSchema = z.object({
  message: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

/**
 * POST /api/customer/tickets/[id]/reply
 * Balasan pelanggan pada tiket miliknya sendiri.
 */
export async function POST(
  request: NextRequest,
  { params }: TicketRouteParams,
) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const body = await parseCustomerTicketBody(request, replyTicketSchema);
  if (body.response) return body.response;

  const { id } = await params;

  try {
    const result = await ticketService.replyToCustomerTicket(
      auth.session.id,
      id,
      body.data,
    );
    return customerTicketSuccess(result);
  } catch (error) {
    return customerTicketErrorResponse(error, "POST reply");
  }
}
