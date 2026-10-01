import { apiSuccess, createHandler } from "@/lib/api";
import { RencanaService, toSalesPresurveiDto } from "@/modules/presurvei";
import { muatKonteksRencana } from "../konteks-rencana";

const service = new RencanaService();

/**
 * GET /api/presurvei/rencana/sales-tersedia — sales yang boleh ditugasi
 * rencana oleh pemanggil: admin seluruh sales tenant, kepala sales dirinya +
 * timnya. Hanya untuk pemberi tugas (permission web `presurvei_rencana:create`).
 */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_rencana:create"] },
  async (_request, ctx) => {
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, service);
    const sales = await service.salesTersedia(pengguna, lingkup);
    return apiSuccess(sales.map(toSalesPresurveiDto));
  },
);
