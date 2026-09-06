import {
  createHandler,
  apiSuccess,
  ApiErrors,
  requireSessionTenantId,
} from "@/lib/api";
import { planningService, updatePlanningSchema } from "@/modules/planning";

/**
 * GET /api/planning/[id]
 * Get planning by ID dengan relasi lengkap
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const result = await planningService.getById(
      ctx.params.id,
      requireSessionTenantId(ctx),
    );

    if (!result) {
      return ApiErrors.notFound("Rencana");
    }

    return apiSuccess(result);
  },
);

/**
 * PUT /api/planning/[id]
 * Update planning data.
 *
 * Tanpa blok catch penerjemah: service melempar `AppError` domain yang sudah
 * membawa status code. Pola lama memeriksa `err.message.includes("cannot be
 * edited")`, sehingga guard ruang lingkup yang melempar "Planning scope cannot
 * be changed ..." tidak cocok dan jatuh ke 500.
 *
 * Activity log ditulis di service, bukan di sini — sebelumnya keduanya menulis
 * dan setiap perubahan menghasilkan dua entri aktivitas.
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: updatePlanningSchema,
  },
  async (req, ctx) => {
    const result = await planningService.update(
      ctx.params.id,
      ctx.validated,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(result, { message: "Planning berhasil diperbarui" });
  },
);

/**
 * DELETE /api/planning/[id]
 * Soft delete planning
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:delete"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;

    await planningService.delete(
      id,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess({ id }, { message: "Planning berhasil dihapus" });
  },
);
