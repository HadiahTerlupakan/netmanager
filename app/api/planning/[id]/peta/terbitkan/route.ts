import {
  createHandler,
  apiSuccess,
  ApiErrors,
  requireSessionTenantId,
} from "@/lib/api";
import { permissionListAllows } from "@/lib/rbac";
import { planningPetaService } from "@/modules/planning";

/** Izin kedua: memasukkan node ke topologi operasional menuntut hak atas peta. */
const IZIN_BUAT_NODE_OPERASIONAL = "map:create";

/**
 * POST /api/planning/[id]/peta/terbitkan
 * Menerbitkan titik dan jalur rencana menjadi node jaringan nyata.
 *
 * Merencanakan bebas; memasukkan node ke topologi operasional menuntut
 * `planning:update` DAN `map:create`. Keduanya TIDAK boleh ditulis berdampingan
 * di `permissions`: gerbang `createHandler` bersifat "salah satu dari"
 * (`lib/api/handler.ts`, `expandedPerms.some`), sehingga pemegang `map:create`
 * saja ikut lolos. Izin kedua dihitung di sini dan ditolak dengan 403 —
 * berbeda dengan pembacaan peta, ini aksi tulis yang memang harus ditolak
 * seluruhnya, bukan didegradasi.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
  },
  async (_req, ctx) => {
    const isMapCreateAllowed = permissionListAllows(
      {
        permissions: ctx.permissions,
        isSuperAdmin: ctx.session?.user.isSuperAdmin,
      },
      IZIN_BUAT_NODE_OPERASIONAL,
    );

    if (!isMapCreateAllowed) {
      return ApiErrors.forbidden(
        "Menerbitkan peta rencana memerlukan izin map:create",
      );
    }

    const hasil = await planningPetaService.terbitkan(
      ctx.params.id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(hasil, { message: "Peta rencana berhasil diterbitkan" });
  },
);
