import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { SalesPresurveiService, toSalesPresurveiDto } from "@/modules/presurvei";

const service = new SalesPresurveiService();

/**
 * GET /api/admin/presurvei/kepala-sales — kandidat kepala sales untuk form
 * user: user aktif di tenant pemanggil yang role-nya boleh memberi rencana
 * (`presurvei_rencana:create`). Gerbangnya izin mengelola user, karena
 * pemakainya form user, bukan layar presurvei.
 */
export const GET = createHandler(
  { auth: true, permissions: ["users:create", "users:update"] },
  async (_request, ctx) => {
    const kandidat = await service.daftarKandidatKepalaSales(
      requireSessionTenantId(ctx),
    );
    return apiSuccess(kandidat.map(toSalesPresurveiDto));
  },
);
