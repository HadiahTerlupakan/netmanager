import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { responsGalatJadwalSo } from "@/lib/api/stock-opname-route";
import { hasPermission } from "@/lib/rbac";
import {
  getStockOpnameJadwalService,
  OPNAME_PESAN,
  periodeStockOpnameDari,
} from "@/modules/inventory";

/**
 * GET ?periode=YYYY-MM — gudang per site yang sudah/belum di-SO bulan itu.
 * Pengguna yang dibatasi per site (`IZIN_PEMBATAS_OPNAME`) hanya melihat gudang di site-nya.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("opname:read")))
    return ApiErrors.forbidden(OPNAME_PESAN.tanpaIzinLihat);
  const user = ctx.session!.user;
  if (!user.tenantId)
    return ApiErrors.badRequest(OPNAME_PESAN.akunTanpaPerusahaan);
  const periode =
    req.nextUrl.searchParams.get("periode") ??
    periodeStockOpnameDari(new Date());
  try {
    const service = getStockOpnameJadwalService();
    const siteIds = await service.getSiteIdsLingkupOpname({
      tenantId: user.tenantId,
      userId: user.id,
      permissions: ctx.permissions,
      isSuperAdmin: isSuperAdmin(user),
    });
    return apiSuccess(
      await service.getKepatuhan(user.tenantId, periode, siteIds),
    );
  } catch (error) {
    return responsGalatJadwalSo(error, "kepatuhan");
  }
});
