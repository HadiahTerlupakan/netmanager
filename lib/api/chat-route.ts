import type { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

import { ApiErrors } from "@/lib/api-response";
import type { ChatFailureCode } from "@/modules/chat";

/**
 * Perekat route chat (admin dan mobile): menerjemahkan hasil gagal service dan
 * galat validasi menjadi respons berbahasa sederhana. Logika bisnisnya tetap
 * di `modules/chat`.
 */

const PESAN_BODY_RUSAK =
  "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu coba lagi.";

type Parsed<T> =
  | { data: T; response?: never }
  | { data?: never; response: NextResponse };

/** Status HTTP per jenis kegagalan aturan chat. */
export function chatFailureResponse(failure: {
  code?: ChatFailureCode;
  error?: string;
}): NextResponse {
  if (failure.code === "INVALID_PARTICIPANTS") {
    return ApiErrors.badRequest(failure.error);
  }
  return ApiErrors.forbidden(failure.error);
}

/** Validasi body JSON; galat pertama dijadikan pesan utama untuk pengguna. */
export async function parseChatBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<Parsed<T>> {
  const body: unknown = await request.json().catch((): undefined => undefined);
  if (body === undefined) {
    return { response: ApiErrors.badRequest(PESAN_BODY_RUSAK) };
  }
  return validate(schema, body);
}

/** Validasi query string dengan skema yang sama gaya pesannya. */
export function parseChatQuery<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Parsed<T> {
  return validate(schema, Object.fromEntries(request.nextUrl.searchParams));
}

function validate<T>(schema: ZodType<T>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { data: result.data };
  }
  const details: Record<string, string> = {};
  for (const issue of result.error.issues) {
    details[issue.path.join(".") || "general"] = issue.message;
  }
  const pesanUtama = result.error.issues[0]?.message ?? PESAN_BODY_RUSAK;
  return { response: ApiErrors.badRequest(pesanUtama, details) };
}
