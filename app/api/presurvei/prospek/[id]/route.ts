import { apiSuccess, createHandler } from "@/lib/api";
import {
  ProspekService,
  toProspekDetail,
  ubahProspekSchema,
} from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "../../akses-presurvei";

const service = new ProspekService();

/**
 * Pemilik yang wajib dicocokkan service, atau undefined bila pemanggil berhak
 * atas seluruh prospek tenant.
 */
function pemilikWajibUntuk(ctx: {
  permissions: string[];
  session: { user: { id: string } } | null;
}): string | undefined {
  return isBolehLihatSemuaPresurvei(ctx.permissions)
    ? undefined
    : ctx.session!.user.id;
}

/** GET /api/presurvei/prospek/[id] — rincian satu prospek. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const prospek = await service.detail(
      ctx.params.id as string,
      pemilikWajibUntuk(ctx),
    );
    return apiSuccess(toProspekDetail(prospek));
  },
);

/** PATCH /api/presurvei/prospek/[id] — perbarui data atau status prospek. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei:update", "m_presurvei:update"],
    schema: ubahProspekSchema,
  },
  async (_request, ctx) => {
    // Pemanggil tanpa permission web tidak boleh mengalihkan kepemilikan —
    // `pemilikId` menentukan siapa yang bisa membaca dan mengubah prospek ini,
    // jadi membiarkannya lewat berarti sales bisa menyerahkan prospeknya ke
    // orang lain lalu kehilangan aksesnya sendiri. Pemilik yang ditugaskan
    // pemegang permission web divalidasi service terhadap tenant baris
    // prospek — sengaja tanpa tenant sesi, yang bagi super admin bisa lain.
    const { pemilikId: _pemilikId, ...perubahanAman } = ctx.validated;
    const bolehTugaskanPemilik = isBolehLihatSemuaPresurvei(ctx.permissions);

    const prospek = await service.ubah(
      ctx.params.id as string,
      bolehTugaskanPemilik ? ctx.validated : perubahanAman,
      pemilikWajibUntuk(ctx),
    );
    return apiSuccess(toProspekDetail(prospek));
  },
);
