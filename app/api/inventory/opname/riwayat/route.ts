import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { responsGalatJadwalSo } from "@/lib/api/stock-opname-route";
import { hasPermission } from "@/lib/rbac";
import {
  getStockOpnameJadwalService,
  periodeStockOpnameDari,
  OPNAME_PESAN,
} from "@/modules/inventory";

/**
 * GET ?gudangId=&periode=YYYY-MM — jejak perubahan catatan stock opname satu
 * gudang pada bulan itu: siapa mengubah apa, dan kapan.
 * Pengguna yang dibatasi per site (`IZIN_PEMBATAS_OPNAME`) hanya bisa membaca gudang di site-nya.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("opname:read")))
    return ApiErrors.forbidden(OPNAME_PESAN.tanpaIzinLihat);
  const user = ctx.session!.user;
  if (!user.tenantId)
    return ApiErrors.badRequest(OPNAME_PESAN.akunTanpaPerusahaan);

  const gudangId = req.nextUrl.searchParams.get("gudangId");
  if (!gudangId) return ApiErrors.badRequest(OPNAME_PESAN.gudangBelumDipilih);
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
    const riwayat = await service.getRiwayatGudang({
      tenantId: user.tenantId,
      gudangId,
      periode,
      siteIds,
    });
    return apiSuccess({ riwayat });
  } catch (error) {
    return responsGalatJadwalSo(error, "riwayat opname");
  }
});
