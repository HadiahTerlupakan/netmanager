import { apiSuccess, createHandler } from "@/lib/api";
import {
  SalesPresurveiService,
  toSalesPresurveiDto,
} from "@/modules/presurvei";

const service = new SalesPresurveiService();

/**
 * GET /api/admin/presurvei/sales — sales aktif di tenant pemanggil.
 *
 * Gerbangnya permission web presurvei, bukan `users:read`/`sales:read`:
 * pemakai layar kegiatan, target, dan laporan belum tentu memegang keduanya.
 * `m_presurvei:read` sengaja tidak ikut — sales lapangan hanya melihat
 * miliknya sendiri (`akses-presurvei.ts`), jadi tidak butuh daftar rekan.
 *
 * Tidak berpaginasi: jumlah sales satu tenant kecil, dan dropdown butuh
 * seluruhnya sekaligus.
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
    // Tenant dari sesi, ditulis eksplisit ke query. Tidak diserahkan ke
    // ekstensi tenant, yang tidak menyaring apa pun untuk super admin.
    const sales = await service.daftarAktif(ctx.session!.user.tenantId);
    return apiSuccess(sales.map(toSalesPresurveiDto));
  },
);
