import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
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
    // Tenant HANYA dari sesi — tidak dari query string, body, atau header —
    // lalu ditulis eksplisit ke query, tidak diserahkan ke ekstensi tenant
    // yang tidak menyaring apa pun untuk super admin. Sesi tanpa tenant
    // dibalas 400 di sini; penjaga di `SalesRepository` tetap sebagai lapis
    // kedua.
    const sales = await service.daftarAktif(requireSessionTenantId(ctx));
    return apiSuccess(sales.map(toSalesPresurveiDto));
  },
);
