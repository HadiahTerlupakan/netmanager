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

/** PUT — jadwal SO khusus untuk bulan :periode (menimpa aturan bawaan). */
export const PUT = createHandler({ auth: true, schema: jadwalKhususSchema }, async (_req, ctx) => {
  if (!(await hasPermission("opname:manage"))) return ApiErrors.forbidden("Akses ditolak");
  const user = ctx.session!.user;
  if (!user.tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  try {
    const jadwal = await getStockOpnameJadwalService().simpanJadwalKhusus(
      user.tenantId,
      ctx.params.periode,
      ctx.validated!,
      user.id,
    );
    return apiSuccess(jadwal);
  } catch (error) {
    return responsGalatJadwalSo(error, "simpan jadwal khusus");
  }
});

/** DELETE — hapus jadwal khusus; bulan itu kembali memakai aturan bawaan. */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("opname:manage"))) return ApiErrors.forbidden("Akses ditolak");
  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  try {
    await getStockOpnameJadwalService().hapusJadwalKhusus(tenantId, ctx.params.periode);
    return apiSuccess(null, { message: "Jadwal kembali memakai aturan bawaan" });
  } catch (error) {
    return responsGalatJadwalSo(error, "hapus jadwal khusus");
  }
});
