import { z } from "zod";

import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import { getPelangganSalesService } from "@/modules/pelanggan";

const tetapkanSalesSchema = z.object({ salesId: z.string().min(1).nullable() });

/** PUT { salesId | null } — tetapkan atau lepas sales penanggung jawab pelanggan. */
export const PUT = createHandler(
  { auth: true, permissions: ["pelanggan:update"], schema: tetapkanSalesSchema },
  async (_req, ctx) => {
    try {
      const hasil = await getPelangganSalesService().tetapkanSales(
        requireSessionTenantId(ctx),
        ctx.params.id,
        ctx.validated!.salesId,
      );
      return apiSuccess(hasil);
    } catch (error) {
      return responsGalatSalesPelanggan(error, "tetapkan sales");
    }
  },
);

/** GET — sales penanggung jawab pelanggan saat ini. */
export const GET = createHandler(
  { auth: true, permissions: ["pelanggan:read", "pelanggan:update"] },
  async (_req, ctx) => {
    try {
      return apiSuccess(await getPelangganSalesService().salesPelanggan(requireSessionTenantId(ctx), ctx.params.id));
    } catch (error) {
      return responsGalatSalesPelanggan(error, "ambil sales pelanggan");
    }
  },
);
