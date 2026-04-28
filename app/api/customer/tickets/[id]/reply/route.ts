import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { SupportTicketService } from "@/modules/pelanggan";

const ticketService = new SupportTicketService();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/customer/tickets/[id]/reply
 * Customer replies to ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  const { session } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const result = await ticketService.replyToCustomerTicket(session.id, id, {
      message: body.message,
      attachments: body.attachments,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("[Customer Tickets Reply POST] Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal mengirim balasan";
    const status =
      message === "Tiket tidak ditemukan"
        ? 404
        : message.includes("tidak boleh kosong") ||
            message.includes("sudah ditutup")
          ? 400
          : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
