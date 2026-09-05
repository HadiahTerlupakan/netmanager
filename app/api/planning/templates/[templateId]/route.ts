import {
  createHandler,
  apiSuccess,
  ApiErrors,
  requireSessionTenantId,
} from "@/lib/api";
import {
  planningTemplateService,
  updatePlanningTemplateSchema,
} from "@/modules/planning";

/**
 * GET /api/planning/templates/[templateId]
 * Get template by ID dengan items
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning:read"],
  },
  async (req, ctx) => {
    const result = await planningTemplateService.getById(
      ctx.params.templateId,
      requireSessionTenantId(ctx),
    );

    if (!result) {
      return ApiErrors.notFound("Template tidak ditemukan");
    }

    return apiSuccess(result);
  },
);

/**
 * PUT /api/planning/templates/[templateId]
 * Update template.
 *
 * `tenantId` diteruskan supaya service bisa menolak template milik tenant lain
 * — guard yang sebelumnya hanya ada di "Terapkan Template", sehingga super
 * admin bisa mengubah BOQ baku tenant lain lewat endpoint ini.
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["planning:update"],
    schema: updatePlanningTemplateSchema,
  },
  async (req, ctx) => {
    const result = await planningTemplateService.update(
      ctx.params.templateId,
      ctx.validated as Parameters<typeof planningTemplateService.update>[1],
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(result, { message: "Template berhasil diperbarui" });
  },
);

/**
 * DELETE /api/planning/templates/[templateId]
 * Delete template
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["planning:delete"],
  },
  async (req, ctx) => {
    const { templateId } = ctx.params;

    await planningTemplateService.delete(
      templateId,
      ctx.session!.user.id,
      requireSessionTenantId(ctx),
    );

    return apiSuccess(
      { id: templateId },
      { message: "Template berhasil dihapus" },
    );
  },
);
