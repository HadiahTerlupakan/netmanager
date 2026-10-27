import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { logger } from "@/lib/logger";
import { ApiErrors } from "@/lib/api-response";

const TICKET_NOT_FOUND_MESSAGE = "Tiket tidak ditemukan";
const INVALID_INPUT_MESSAGE = "Input tidak valid";
const CLIENT_ERROR_MESSAGES = new Set([
  "Kategori, subjek, dan deskripsi wajib diisi",
  "Kategori tidak valid",
  "Pesan atau lampiran tidak boleh kosong",
  "Tiket sudah ditutup",
  "Tiket sudah ditutup dan tidak dapat dibalas",
]);

export interface TicketRouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Respons sukses portal berbentuk datar (`{ success, ...payload }`), bukan
 * `{ success, data }`: halaman /dukungan dan aplikasi mobile membaca
 * `body.ticket`, `body.reply`, dan `body.tickets` langsung.
 */
export function customerTicketSuccess(
  payload: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json({ success: true, ...payload }, { status });
}

/** Parse body JSON lalu validasi dengan skema Zod; gagal → respons 400. */
export async function parseCustomerTicketBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<
  { data: T; response?: never } | { data?: never; response: NextResponse }
> {
  const json = await request.json().catch((): unknown => undefined);
  const parsed = schema.safeParse(json);
  if (parsed.success) return { data: parsed.data };

  const message = parsed.error.issues[0]?.message || INVALID_INPUT_MESSAGE;
  return { response: ApiErrors.badRequest(message) };
}

/**
 * Terjemahkan error SupportTicketService ke status HTTP. Pesan selain yang
 * dikenal tidak diteruskan ke pelanggan karena bisa memuat detail internal.
 */
export function customerTicketErrorResponse(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : "";
  if (message === TICKET_NOT_FOUND_MESSAGE) {
    return ApiErrors.notFound(TICKET_NOT_FOUND_MESSAGE);
  }
  if (CLIENT_ERROR_MESSAGES.has(message)) {
    return ApiErrors.badRequest(message);
  }

  logger.error(`[Customer Tickets] ${context}:`, error);
  return ApiErrors.internalError("Terjadi kesalahan server");
}
