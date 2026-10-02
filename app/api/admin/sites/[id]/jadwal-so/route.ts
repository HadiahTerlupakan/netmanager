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

/** GET ?periode=YYYY-MM — jadwal stock opname site ini (bawaan bulan berjalan WIB). */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("site:read"))) return ApiErrors.forbidden("Akses ditolak");
  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  const periode = req.nextUrl.searchParams.get("periode") ?? periodeStockOpnameDari(new Date());
  try {
    return apiSuccess(await getStockOpnameJadwalService().getJadwalSite(tenantId, ctx.params.id, periode));
  } catch (error) {
    return responsGalatJadwalSo(error, "ambil jadwal site");
  }
});

/** PUT — jadwal bawaan site "tanggal X–Y setiap bulan" dan saklar pengingat. */
export const PUT = createHandler({ auth: true, schema: aturanSchema }, async (_req, ctx) => {
  if (!(await hasPermission("site:update"))) return ApiErrors.forbidden("Akses ditolak");
  const tenantId = ctx.session!.user.tenantId;
  if (!tenantId) return ApiErrors.badRequest("Tenant tidak ditemukan");
  try {
    return apiSuccess(
      await getStockOpnameJadwalService().simpanAturanSite(tenantId, ctx.params.id, ctx.validated!),
    );
  } catch (error) {
    return responsGalatJadwalSo(error, "simpan jadwal bawaan site");
  }
});
