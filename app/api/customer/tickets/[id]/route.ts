import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { SupportTicketService } from "@/modules/pelanggan";
import {
  customerTicketErrorResponse,
  customerTicketSuccess,
  type TicketRouteParams,
} from "../route-helpers";

const ticketService = new SupportTicketService();

/**
 * GET /api/customer/tickets/[id]
 * Detail tiket beserta balasan; tiket pelanggan lain dijawab 404.
 */
export async function GET(request: NextRequest, { params }: TicketRouteParams) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    const ticket = await ticketService.getCustomerTicketDetail(
      auth.session.id,
      id,
    );
    return customerTicketSuccess({ ticket });
  } catch (error) {
    return customerTicketErrorResponse(error, "GET detail");
  }
}
