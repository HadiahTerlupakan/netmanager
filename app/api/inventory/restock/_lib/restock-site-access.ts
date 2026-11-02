import { NextResponse } from "next/server";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import {
  getInventoryRouteService,
  IZIN_PEMBATAS_RESTOCK,
  RESTOCK_MESSAGES,
} from "@/modules/inventory";

const HTTP_FORBIDDEN = 403;

/** User sesi NextAuth atau `createHandler`; `id` opsional di tipe NextAuth. */
interface RestockSessionUser {
  id?: string;
  role?: string | null;
  isSuperAdmin?: boolean;
}

/** Identitas akses pengguna restock untuk pemeriksaan lingkup site. */
async function resolvePengguna(user: RestockSessionUser & { id: string }) {
  return {
    userId: user.id,
    permissions: await getUserPermissions(user.id),
    isSuperAdmin: isSuperAdmin(user),
  };
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: HTTP_FORBIDDEN });
}

/**
 * Tolak detail atau aksi pada pengajuan restock yang gudangnya di luar
 * lingkup `restock:site_only` pengguna — pembatas yang sama dengan daftarnya.
 * Pengajuan yang tidak ada dibiarkan lolos agar route melaporkan 404 sendiri.
 */
export async function ensureRestockRequestSiteAccess(input: {
  user: RestockSessionUser;
  purchaseRequestId: string;
  tenantId: string;
}): Promise<NextResponse | null> {
  const { id } = input.user;
  // Sesi tanpa id tidak bisa diperiksa lingkupnya: gagal-tertutup.
  if (!id) return forbidden(RESTOCK_MESSAGES.requestBedaSite);

  const bolehAkses = await getInventoryRouteService().canAccessPurchaseRequest({
    ...(await resolvePengguna({ ...input.user, id })),
    id: input.purchaseRequestId,
    tenantId: input.tenantId,
  });
  return bolehAkses ? null : forbidden(RESTOCK_MESSAGES.requestBedaSite);
}

/** Tolak pengajuan baru atau perubahan yang menunjuk gudang site lain. */
export async function ensureRestockGudangSiteAccess(input: {
  user: RestockSessionUser;
  gudangId: string;
}): Promise<NextResponse | null> {
  const { id } = input.user;
  if (!id) return forbidden(RESTOCK_MESSAGES.gudangBedaSite);

  const bolehAkses = await getInventoryRouteService().canAccessGudang({
    ...(await resolvePengguna({ ...input.user, id })),
    gudangId: input.gudangId,
    restrictedPermissions: IZIN_PEMBATAS_RESTOCK,
  });
  return bolehAkses ? null : forbidden(RESTOCK_MESSAGES.gudangBedaSite);
}
