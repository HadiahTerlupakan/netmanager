import type { NextRequest } from "next/server";
import {
  apiSuccess,
  createHandler,
  requireSessionTenantId,
  type HandlerContext,
} from "@/lib/api";
import {
  SalesPresurveiService,
  toSalesPresurveiDto,
  type AksesTenantPresurvei,
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
 *
 * `?prospekId=` (pemilih pemilik prospek): sales aktif di tenant prospek itu,
 * diturunkan di server. 404 bila prospek di luar jangkauan pemanggil, 422
 * `PROSPEK_TANPA_TENANT` bila prospeknya tak bertenant.
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
  async (request: NextRequest, ctx) => {
    // Pemilih pemilik prospek: tenant diturunkan server dari prospek acuan,
    // supaya super admin yang membuka prospek tenant lain ditawari sales
    // tenant prospek itu — satu-satunya yang akan diterima validasi
    // penugasan. `tenantId` dari query string tidak pernah dibaca.
    const prospekId = new URL(request.url).searchParams.get("prospekId");
    if (prospekId) {
      const salesProspek = await service.daftarAktifUntukProspek(
        prospekId,
        aksesTenantPemanggil(ctx),
      );
      return apiSuccess(salesProspek.map(toSalesPresurveiDto));
    }

    // Tenant HANYA dari sesi — tidak dari query string, body, atau header —
    // lalu ditulis eksplisit ke query, tidak diserahkan ke ekstensi tenant
    // yang tidak menyaring apa pun untuk super admin. Sesi tanpa tenant
    // dibalas 400 di sini; penjaga di `SalesRepository` tetap sebagai lapis
    // kedua.
    const sales = await service.daftarAktif(requireSessionTenantId(ctx));
    return apiSuccess(sales.map(toSalesPresurveiDto));
  },
);

/**
 * Cakupan tenant pemanggil: super admin lintas tenant, selain itu terikat
 * tenant sesi (400 bila sesi tak bertenant).
 */
function aksesTenantPemanggil(
  ctx: Pick<HandlerContext, "session">,
): AksesTenantPresurvei {
  if (ctx.session?.user?.isSuperAdmin) return { jenis: "lintas-tenant" };
  return { jenis: "tenant", tenantId: requireSessionTenantId(ctx) };
}
