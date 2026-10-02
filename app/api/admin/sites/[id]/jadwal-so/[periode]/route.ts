import { z } from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { responsGalatJadwalSo } from "@/lib/api/stock-opname-route";
import { hasPermission } from "@/lib/rbac";
import { getStockOpnameJadwalService } from "@/modules/inventory";

const PANJANG_CATATAN_MAKS = 500;

const jadwalKhususSchema = z.object({
  mulai: z.string(),
  selesai: z.string(),
  catatan: z.string().max(PANJANG_CATATAN_MAKS).nullable().optional(),
});

/** PUT — jadwal SO khusus site ini untuk bulan :periode (menimpa jadwal bawaan). */
export const PUT = createHandler({ auth: true, schema: jadwalKhususSchema }, async (_req, ctx) => {
  if (!(await hasPermission("site:update"))) return ApiErrors.forbidden("Akses ditolak");
  const user = ctx.session!.user;
  if (!user.tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  try {
    const jadwal = await getStockOpnameJadwalService().simpanJadwalKhususSite(
      user.tenantId,
      ctx.params.id,
      ctx.params.periode,
      ctx.validated!,
      user.id,
    );
    return apiSuccess(jadwal);
  } catch (error) {
    return responsGalatJadwalSo(error, "simpan jadwal khusus site");
  }
});

/** DELETE — hapus jadwal khusus; bulan itu kembali memakai jadwal bawaan site. */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("site:update"))) return ApiErrors.forbidden("Akses ditolak");
  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  try {
    await getStockOpnameJadwalService().hapusJadwalKhususSite(tenantId, ctx.params.id, ctx.params.periode);
    return apiSuccess(null, { message: "Bulan itu kembali memakai jadwal bawaan site" });
  } catch (error) {
    return responsGalatJadwalSo(error, "hapus jadwal khusus site");
  }
});
