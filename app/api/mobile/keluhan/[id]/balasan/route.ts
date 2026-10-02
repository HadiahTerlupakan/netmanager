import { apiSuccess, createHandler } from "@/lib/api";
import { muatSaringanSales, penggunaPemanggil } from "@/lib/api/lingkup-sales";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import {
  balasKeluhanSchema,
  getKeluhanSalesService,
} from "@/modules/pelanggan";

const HTTP_CREATED = 201;

/** POST { pesan } — sales membalas helpdesk pada keluhan dalam lingkupnya. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["m_presurvei:create"],
    schema: balasKeluhanSchema,
  },
  async (_req, ctx) => {
    try {
      return apiSuccess(
        await getKeluhanSalesService().balas(
          penggunaPemanggil(ctx),
          await muatSaringanSales(ctx),
          ctx.params.id,
          ctx.validated!.pesan,
        ),
        { status: HTTP_CREATED },
      );
    } catch (error) {
      return responsGalatSalesPelanggan(error, "balas keluhan");
    }
  },
);
