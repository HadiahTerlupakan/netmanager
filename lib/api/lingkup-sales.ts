import { requireSessionTenantId, type HandlerContext } from "@/lib/api";
import { jenisLingkupDariIzin, RencanaService, type LingkupRencana } from "@/modules/presurvei";

/** Sales yang datanya boleh dilihat pemanggil; `null` = seluruh tenant. */
export type SaringanSalesPemanggil = { salesIds: string[] } | null;

const rencanaService = new RencanaService();

function saringanDariLingkup(lingkup: LingkupRencana): SaringanSalesPemanggil {
  if (lingkup.jenis === "SEMUA") return null;
  if (lingkup.jenis === "TIM") return { salesIds: [lingkup.penggunaId, ...lingkup.anggotaIds] };
  return { salesIds: [lingkup.penggunaId] };
}

/**
 * Lingkup data sales pemanggil, mengikuti lingkup rencana presurvei: sales =
 * dirinya, kepala sales = dirinya + anggota tim, head of sales/admin
 * (`presurvei_rencana:view_all`) = seluruh tenant. Dipakai tunggakan,
 * pelanggan saya, dan keluhan pelanggan.
 */
export async function muatSaringanSales(
  ctx: Pick<HandlerContext, "session" | "permissions">,
): Promise<SaringanSalesPemanggil> {
  const pengguna = { id: ctx.session!.user.id, tenantId: requireSessionTenantId(ctx) };
  const lingkup = await rencanaService.lingkup(pengguna, jenisLingkupDariIzin(ctx.permissions));
  return saringanDariLingkup(lingkup);
}
