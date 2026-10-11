import { createHandler, apiSuccess, requireSessionTenantId } from "@/lib/api";
import { planningPetaService } from "@/modules/planning";

/**
 * POST /api/planning/[id]/peta/terbitkan
 * Menerbitkan titik dan jalur rencana menjadi node jaringan nyata.
 *
 * Merencanakan bebas; memasukkan node ke topologi operasional menuntut
 * `planning:update` DAN `map:create`. Keduanya TIDAK boleh ditulis di
 * `permissions`: gerbang itu bersifat "salah satu dari", sehingga pemegang
 * `map:create` saja ikut lolos. `permissionsAll` adalah gerbang "DAN"-nya.
 *
 * Berbeda dengan pembacaan peta, ini aksi tulis: kekurangan izin ditolak 403
 * seluruhnya, bukan didegradasi.
 */
export const POST = createHandler(
  {
    auth: true,
    permissionsAll: ["planning:update", "map:create"],
  },
  async (_req, ctx) => {
    const hasil = await planningPetaService.terbitkan(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(hasil, { message: "Peta rencana berhasil diterbitkan" });
  },
);
