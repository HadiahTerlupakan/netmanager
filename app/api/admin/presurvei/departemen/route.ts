import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  DepartemenPresurveiService,
  toDepartemenPresurveiDto,
} from "@/modules/presurvei";

const service = new DepartemenPresurveiService();

/**
 * GET /api/admin/presurvei/departemen — departemen di tenant pemanggil, untuk
 * filter "Departemen" layar kegiatan.
 *
 * Gerbangnya sama dengan `GET /api/admin/presurvei/sales`: permission web
 * presurvei, bukan `department:read`. `GET /api/admin/departments` menuntut
 * `department:read`/`users:create`, dan layar presurvei tidak boleh menuntut
 * izin modul lain.
 *
 * Tenant HANYA dari sesi — tidak dari query string, body, atau header — lalu
 * ditulis eksplisit ke query. Sesi tanpa tenant dibalas 400; penjaga di
 * `DepartemenRepository` tetap sebagai lapis kedua. Tidak berpaginasi:
 * dropdown butuh seluruhnya, dan jumlah departemen satu tenant kecil.
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: [
      "presurvei:read",
      "presurvei_target:read",
      "presurvei_laporan:read",
    ],
  },
  async (_request, ctx) => {
    const departemen = await service.daftar(requireSessionTenantId(ctx));
    return apiSuccess(departemen.map(toDepartemenPresurveiDto));
  },
);
