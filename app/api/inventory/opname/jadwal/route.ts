import { z } from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { responsGalatJadwalSo } from "@/lib/api/stock-opname-route";
import { hasPermission } from "@/lib/rbac";
import { getStockOpnameJadwalService, periodeStockOpnameDari } from "@/modules/inventory";

const aturanSchema = z.object({
  isAktif: z.boolean(),
  tanggalMulai: z.number().int().min(1).max(31),
  tanggalSelesai: z.number().int().min(1).max(31),
});

/** GET ?periode=YYYY-MM — jadwal SO bulan itu (bawaan bulan berjalan WIB). */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("opname:read"))) return ApiErrors.forbidden("Akses ditolak");
  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  const periode = req.nextUrl.searchParams.get("periode") ?? periodeStockOpnameDari(new Date());
  try {
    return apiSuccess(await getStockOpnameJadwalService().getJadwal(tenantId, periode));
  } catch (error) {
    return responsGalatJadwalSo(error, "ambil jadwal");
  }
});

/** PUT — simpan aturan bawaan "tanggal X–Y setiap bulan" dan saklar pengingat. */
export const PUT = createHandler({ auth: true, schema: aturanSchema }, async (_req, ctx) => {
  if (!(await hasPermission("opname:manage"))) return ApiErrors.forbidden("Akses ditolak");
  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  try {
    return apiSuccess(await getStockOpnameJadwalService().simpanAturan(tenantId, ctx.validated!));
  } catch (error) {
    return responsGalatJadwalSo(error, "simpan aturan");
  }
});
