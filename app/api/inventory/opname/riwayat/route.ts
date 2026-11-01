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
 * Pengguna `opname:site_only` hanya bisa membaca gudang di site-nya.
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
    const isSiteOnly =
      !isSuperAdmin(user) && (await hasPermission("opname:site_only"));
    const siteIds = isSiteOnly
      ? await service.getSiteIdsPengguna(user.tenantId, user.id)
      : null;
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
