import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import {
  planningPetaService,
  buatTitikRencanaSchema,
} from "@/modules/planning";

/** Nilai `?lingkup=` yang juga mengembalikan node jaringan nyata sebagai latar. */
const LINGKUP_SEMUA = "semua";

/**
 * GET /api/planning/[id]/peta/titik
 * Seluruh titik dan jalur rencana pada peta planning.
 *
 * `?lingkup=semua` menambahkan node jaringan nyata milik tenant yang sama,
 * supaya rencana bisa digambar di atas konteks jaringan yang sudah berdiri.
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const peta = await planningPetaService.ambilPeta(
      ctx.params.id,
      requireSessionTenantId(ctx),
      {
        sertakanNodeNyata:
          req.nextUrl.searchParams.get("lingkup") === LINGKUP_SEMUA,
      },
    );

    return apiSuccess(peta);
  },
);

/**
 * POST /api/planning/[id]/peta/titik
 * Menambah titik rencana. Aturan ada di `PlanningPetaService`.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: buatTitikRencanaSchema,
  },
  async (req, ctx) => {
    const titik = await planningPetaService.tambahTitik(
      ctx.params.id,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(titik, {
      status: 201,
      message: "Titik rencana berhasil ditambahkan",
    });
  },
);
