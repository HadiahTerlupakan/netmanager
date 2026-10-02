import { requireSessionTenantId, type HandlerContext } from "@/lib/api";
import type {
  JenisLingkupRencana,
  LingkupRencana,
  PenggunaRencana,
  RencanaService,
} from "@/modules/presurvei";
import { jenisLingkupDariIzin } from "@/modules/roles";

/** Pemanggil route rencana beserta lingkup aksesnya. */
export interface KonteksRencana {
  pengguna: PenggunaRencana;
  lingkup: LingkupRencana;
}

/**
 * Turunkan pengguna (tenant HANYA dari sesi) dan lingkup rencananya.
 *
 * Jenis lingkup diputuskan dari permission (`jenisLingkupDariIzin` di modul
 * roles); service hanya memuat anggota tim untuk lingkup TIM.
 */
export async function muatKonteksRencana(
  ctx: Pick<HandlerContext, "session" | "permissions">,
  service: RencanaService,
  tentukanJenis: (permissions: string[]) => JenisLingkupRencana = jenisLingkupDariIzin,
): Promise<KonteksRencana> {
  const pengguna: PenggunaRencana = {
    id: ctx.session!.user.id,
    tenantId: requireSessionTenantId(ctx),
  };
  const lingkup = await service.lingkup(pengguna, tentukanJenis(ctx.permissions));
  return { pengguna, lingkup };
}
