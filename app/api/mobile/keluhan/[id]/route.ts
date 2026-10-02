import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { muatSaringanSales } from "@/lib/api/lingkup-sales";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import { getKeluhanSalesService } from "@/modules/pelanggan";

/** GET — detail keluhan: percakapan helpdesk dan WO yang menanganinya (404 di luar lingkup). */
export const GET = createHandler(
  { auth: true, permissions: ["m_presurvei:read"] },
  async (_req, ctx) => {
    try {
      return apiSuccess(
        await getKeluhanSalesService().detail(
          requireSessionTenantId(ctx),
          await muatSaringanSales(ctx),
          ctx.params.id,
        ),
      );
    } catch (error) {
      return responsGalatSalesPelanggan(error, "detail keluhan");
    }
  },
);
