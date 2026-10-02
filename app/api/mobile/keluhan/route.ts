import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { muatSaringanSales, penggunaPemanggil } from "@/lib/api/lingkup-sales";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import { parseQuery } from "@/lib/api/query-parser";
import {
  daftarKeluhanQuerySchema,
  getKeluhanSalesService,
  laporKeluhanSchema,
} from "@/modules/pelanggan";

const HTTP_CREATED = 201;

/**
 * GET — keluhan pelanggan dalam lingkup sales (sendiri / tim / seluruh tenant):
 * terbuka atau selesai, opsional per sales, berhalaman.
 */
export const GET = createHandler(
  { auth: true, permissions: ["m_presurvei:read"] },
  async (req, ctx) => {
    const query = daftarKeluhanQuerySchema.parse(
      parseQuery(new URL(req.url).searchParams),
    );
    try {
      return apiSuccess(
        await getKeluhanSalesService().daftar(
          requireSessionTenantId(ctx),
          await muatSaringanSales(ctx),
          query,
        ),
      );
    } catch (error) {
      return responsGalatSalesPelanggan(error, "daftar keluhan");
    }
  },
);

/** POST — sales mencatat keluhan atas nama pelanggannya; diteruskan ke helpdesk sebagai tiket. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["m_presurvei:create"],
    schema: laporKeluhanSchema,
  },
  async (_req, ctx) => {
    try {
      return apiSuccess(
        await getKeluhanSalesService().lapor(
          penggunaPemanggil(ctx),
          await muatSaringanSales(ctx),
          ctx.validated!,
        ),
        { status: HTTP_CREATED },
      );
    } catch (error) {
      return responsGalatSalesPelanggan(error, "lapor keluhan");
    }
  },
);
