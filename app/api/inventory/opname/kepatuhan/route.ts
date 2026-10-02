import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { responsGalatJadwalSo } from "@/lib/api/stock-opname-route";
import { hasPermission } from "@/lib/rbac";
import { getStockOpnameJadwalService, periodeStockOpnameDari } from "@/modules/inventory";

/**
 * GET ?periode=YYYY-MM — gudang per site yang sudah/belum di-SO bulan itu.
 * Pengguna `opname:site_only` hanya melihat gudang di site-nya.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("opname:read"))) return ApiErrors.forbidden("Akses ditolak");
  const user = ctx.session!.user;
  if (!user.tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  const periode = req.nextUrl.searchParams.get("periode") ?? periodeStockOpnameDari(new Date());
  try {
    const service = getStockOpnameJadwalService();
    const isSiteOnly = !isSuperAdmin(user as never) && (await hasPermission("opname:site_only"));
    const siteIds = isSiteOnly ? await service.siteIdsPengguna(user.id) : null;
    return apiSuccess(await service.getKepatuhan(user.tenantId, periode, siteIds));
  } catch (error) {
    return responsGalatJadwalSo(error, "kepatuhan");
  }
});
