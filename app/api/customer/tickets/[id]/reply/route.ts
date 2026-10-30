import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiErrors } from "@/lib/api-response";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { lampiranMilikPelanggan } from "@/lib/upload/lampiran-pelanggan";
import { SupportTicketService } from "@/modules/pelanggan";
import {
  customerTicketErrorResponse,
  customerTicketSuccess,
  parseCustomerTicketBody,
  type TicketRouteParams,
} from "../../route-helpers";

const ticketService = new SupportTicketService();

const MAX_ATTACHMENTS = 5;

// Lampiran harus berkas yang diunggah lewat /api/customer/tickets/attachments:
// lampiran tiket bukan kunci R2 publik, jadi URL-nya selalu jalur relatif ini.
// Tanpa batas ini pelanggan bisa menitipkan URL apa pun (javascript:, domain
// luar) yang lalu dibuka staf di helpdesk.
const TICKET_ATTACHMENT_PATH =
  /^\/uploads\/(tenants\/[A-Za-z0-9-]+\/)?tickets\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

const attachmentPathSchema = z
  .string()
  .regex(TICKET_ATTACHMENT_PATH, "Lampiran tidak valid")
  .refine((path) => !path.includes(".."), "Lampiran tidak valid");

// Pesan boleh kosong bila ada lampiran; aturan itu dijaga SupportTicketService.
const replyTicketSchema = z.object({
  message: z.string().optional(),
  attachments: z.array(attachmentPathSchema).max(MAX_ATTACHMENTS).optional(),
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

  // /uploads/ opens a customer's own folder to them, so a reply may carry
  // only files from that folder, never a path cited from someone else's.
  const lampiran = body.data.attachments ?? [];
  if (
    !lampiran.every((jalur) => lampiranMilikPelanggan(jalur, auth.session.id))
  ) {
    return ApiErrors.badRequest("Lampiran tidak valid");
  }

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
