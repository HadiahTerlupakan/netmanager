import { apiSuccess, createHandler } from "@/lib/api";
import {
  PenilaianService,
  penilaianPeriodeSchema,
  RencanaService,
} from "@/modules/presurvei";
import { jenisLingkupPenilaian } from "../akses-presurvei";
import { muatKonteksRencana } from "../rencana/konteks-rencana";

const penilaian = new PenilaianService();
const rencana = new RencanaService();

/**
 * GET /api/presurvei/penilaian?tahun&bulan — penilaian kinerja bulanan
 * (tanpa query = bulan berjalan).
 *
 * Lingkup: admin seluruh kepala sales & timnya, kepala sales dirinya + timnya,
 * sales dirinya saja (`jenisLingkupPenilaian`).
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["presurvei_rencana:read", "presurvei_laporan:read", "m_presurvei:read"],
  },
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const periode = penilaianPeriodeSchema.parse({
      tahun: searchParams.get("tahun") ?? undefined,
      bulan: searchParams.get("bulan") ?? undefined,
    });
    const { pengguna, lingkup } = await muatKonteksRencana(ctx, rencana, jenisLingkupPenilaian);
    const diminta =
      periode.tahun !== undefined && periode.bulan !== undefined
        ? { tahun: periode.tahun, bulan: periode.bulan }
        : null;
    const hasil = await penilaian.nilai(diminta, lingkup, pengguna.tenantId);
    return apiSuccess(hasil);
  },
);
