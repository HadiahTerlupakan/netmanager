import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { SupportTicketService } from "@/modules/pelanggan";

const ticketService = new SupportTicketService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customer/tickets/[id]
 * Get ticket detail with replies
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { session } = auth;
  const { id } = await params;

  try {
    const ticket = await ticketService.getCustomerTicketDetail(session.id, id);
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("[Customer Tickets GET Detail] Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal mengambil detail tiket";
    const status = message === "Tiket tidak ditemukan" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
