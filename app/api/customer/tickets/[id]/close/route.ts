import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { SupportTicketService } from "@/modules/pelanggan";

const ticketService = new SupportTicketService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/customer/tickets/[id]/close
 * Customer closes their own ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { session } = auth;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await ticketService.closeCustomerTicket(session.id, id, {
      feedback: body.feedback,
      rating: body.rating,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    logger.error("[Customer Ticket Close] Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal menutup tiket";
    const status =
      message === "Tiket tidak ditemukan"
        ? 404
        : message.includes("akses")
          ? 403
          : message.includes("sudah ditutup")
            ? 400
            : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
