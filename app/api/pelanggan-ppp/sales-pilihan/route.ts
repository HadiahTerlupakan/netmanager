import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { getPelangganSalesService } from "@/modules/pelanggan";

/** GET — sales aktif tenant untuk pilihan "sales penanggung jawab" di form pelanggan. */
export const GET = createHandler(
  { auth: true, permissions: ["pelanggan:create", "pelanggan:update"] },
  async (_req, ctx) => apiSuccess(await getPelangganSalesService().daftarSalesPilihan(requireSessionTenantId(ctx))),
);
