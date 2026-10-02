import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { responsGalatSalesPelanggan } from "@/lib/api/pelanggan-sales-route";
import { getPelangganSalesService } from "@/modules/pelanggan";
import { RencanaService, type LingkupRencana } from "@/modules/presurvei";

import { muatKonteksRencana } from "../../../presurvei/rencana/konteks-rencana";

const rencanaService = new RencanaService();

/** Sales yang tunggakannya boleh dilihat: diri sendiri, tim, atau seluruh tenant (null). */
function saringanDariLingkup(lingkup: LingkupRencana) {
  if (lingkup.jenis === "SEMUA") return null;
  if (lingkup.jenis === "TIM") return { salesIds: [lingkup.penggunaId, ...lingkup.anggotaIds] };
  return { salesIds: [lingkup.penggunaId] };
}

/**
 * GET — pelanggan isolir yang perlu ditindaklanjuti pembayarannya, per sales
 * penanggung jawab. Lingkup mengikuti rencana presurvei: sales melihat
 * pelanggannya sendiri, kepala sales timnya, head of sales/admin seluruh tenant.
 */
export const GET = createHandler({ auth: true, permissions: ["m_presurvei:read"] }, async (_req, ctx) => {
  try {
    const { lingkup } = await muatKonteksRencana(ctx, rencanaService);
    return apiSuccess(
      await getPelangganSalesService().daftarTunggakan(requireSessionTenantId(ctx), saringanDariLingkup(lingkup)),
    );
  } catch (error) {
    return responsGalatSalesPelanggan(error, "daftar tunggakan");
  }
});
