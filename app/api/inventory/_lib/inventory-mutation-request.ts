import type { NextResponse } from "next/server";

import { ApiErrors } from "@/lib/api";
import {
  buildInventoryAccessSession,
  describeGudangAccessDenial,
  IZIN_PEMBATAS_KELUAR,
  IZIN_PEMBATAS_MASUK,
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

/** Konteks `createHandler` yang dibutuhkan cek akses gudang. */
interface InventoryHandlerContext {
  session: { user: { id: string } } | null;
  /** Permission pengguna — objek user sesi tidak membawanya. */
  permissions: string[];
}

/**
 * Pembatas site per jenis pencatatan, sama dengan yang dipakai daftar
 * endpoint-nya, supaya toggle yang menyembunyikan mutasi site lain juga
 * mencegah pencatatannya.
 */
const IZIN_PEMBATAS_PENCATATAN = {
  masuk: IZIN_PEMBATAS_MASUK,
  keluar: IZIN_PEMBATAS_KELUAR,
} as const;

/**
 * Tolak pencatatan di gudang yang tidak boleh dipakai user ini (beda site).
 * Gudang kosong dibiarkan lolos: service melaporkannya bersama masalah isian
 * lain, sedangkan cek akses tanpa gudang hanya akan gagal di database.
 */
export async function ensureCreateGudangAccess(
  ctx: InventoryHandlerContext,
  body: Record<string, unknown>,
  jenisPencatatan: keyof typeof IZIN_PEMBATAS_PENCATATAN,
): Promise<NextResponse | null> {
  if (!body.gudangId) return null;

  const accessSession = await buildInventoryAccessSession(
    ctx.session!.user,
    ctx.permissions,
  );
  const access = await validateGudangSiteAccess(
    accessSession,
    String(body.gudangId),
    IZIN_PEMBATAS_PENCATATAN[jenisPencatatan],
  );
  return access.allowed
    ? null
    : ApiErrors.forbidden(describeGudangAccessDenial(access.error));
}
