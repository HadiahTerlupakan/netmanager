import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { muatSaringanSales } from "@/lib/api/lingkup-sales";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import { parseQuery } from "@/lib/api/query-parser";
import { getPelangganSalesService, pelangganSayaQuerySchema } from "@/modules/pelanggan";

/**
 * GET — pelanggan yang dipegang sales pemanggil (lingkup sendiri / tim / seluruh
 * tenant) beserta WO terbuka dan jumlah keluhan terbuka; berhalaman.
 */
export const GET = createHandler({ auth: true, permissions: ["m_presurvei:read"] }, async (req, ctx) => {
  const filter = pelangganSayaQuerySchema.parse(parseQuery(new URL(req.url).searchParams));
  try {
    return apiSuccess(
      await getPelangganSalesService().daftarPelangganSaya(
        requireSessionTenantId(ctx),
        await muatSaringanSales(ctx),
        filter,
      ),
    );
  } catch (error) {
    return responsGalatSalesPelanggan(error, "pelanggan saya");
  }
});
