import type { HandlerContext } from "@/lib/api";
import { lingkupKelolaSite, type LingkupSite } from "@/modules/roles";

/**
 * Lingkup `site:site_only` pemanggil untuk layar manajemen site (detail, ubah,
 * hapus, jadwal SO per site). Dipakai bersama supaya semua route site membaca
 * pembatasan dengan cara yang sama.
 */
export function lingkupKelolaSitePemanggil(
  ctx: Pick<HandlerContext, "session" | "permissions">,
): LingkupSite {
  return lingkupKelolaSite({
    user: ctx.session!.user,
    permissions: ctx.permissions,
  });
}
