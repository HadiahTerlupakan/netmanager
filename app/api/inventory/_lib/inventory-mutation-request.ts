import type { NextResponse } from "next/server";

import { ApiErrors } from "@/lib/api";
import {
  buildInventoryAccessSession,
  describeGudangAccessDenial,
  validateGudangSiteAccess,
} from "@/modules/inventory";

import { INVENTORY_UNREADABLE_BODY_MESSAGE } from "./inventory-failure-response";

type ParsedBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/** Baca body JSON berbentuk objek; selain itu balas 400 berpesan jelas. */
export async function parseInventoryMutationBody(
  req: Request,
): Promise<ParsedBody> {
  const body: unknown = await req.json().catch((): null => null);
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    return { ok: true, body: body as Record<string, unknown> };
  }
  return {
    ok: false,
    response: ApiErrors.badRequest(INVENTORY_UNREADABLE_BODY_MESSAGE),
  };
}

/**
 * Tolak pencatatan di gudang yang tidak boleh dipakai user ini (beda site).
 * Gudang kosong dibiarkan lolos: service melaporkannya bersama masalah isian
 * lain, sedangkan cek akses tanpa gudang hanya akan gagal di database.
 */
export async function ensureCreateGudangAccess(
  user: { id: string },
  gudangId: unknown,
): Promise<NextResponse | null> {
  if (!gudangId) return null;

  const accessSession = await buildInventoryAccessSession(user);
  const access = await validateGudangSiteAccess(
    accessSession,
    String(gudangId),
  );
  return access.allowed
    ? null
    : ApiErrors.forbidden(describeGudangAccessDenial(access.error));
}
