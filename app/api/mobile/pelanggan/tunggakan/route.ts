import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { muatSaringanSales } from "@/lib/api/lingkup-sales";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import { getPelangganSalesService } from "@/modules/pelanggan";

/**
 * GET — pelanggan isolir yang perlu ditindaklanjuti pembayarannya, per sales
 * penanggung jawab (lingkup: sendiri / tim / seluruh tenant).
 */
export const GET = createHandler({ auth: true, permissions: ["m_presurvei:read"] }, async (_req, ctx) => {
  try {
    return apiSuccess(
      await getPelangganSalesService().daftarTunggakan(requireSessionTenantId(ctx), await muatSaringanSales(ctx)),
    );
  } catch (error) {
    return responsGalatSalesPelanggan(error, "daftar tunggakan");
  }
});
