import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { getTaxRateConfigService } from "@/modules/tax";
import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.enum(["PPN", "PPH", "BHP_USO", "OTHER"]).optional(),
  rate: z.number().min(0).max(100).optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  dueMonth: z.number().int().min(1).max(12).nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * PUT /api/admin/tax/rate-configs/[id] — update tarif pajak.
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("tax:manage"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah tarif pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const id = ctx.params?.id;
  if (!id) {
    return ApiErrors.badRequest("ID tarif tidak valid");
  }

  const validation = await validateRequestBody(req, updateSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  try {
    const updated = await getTaxRateConfigService().update(
      id,
      tenantId,
      validation.data as z.infer<typeof updateSchema>,
    );
    return apiSuccess(updated, { message: "Tarif pajak berhasil diperbarui" });
  } catch (err) {
    return mapDomainError(err);
  }
});

/**
 * DELETE /api/admin/tax/rate-configs/[id] — hapus tarif pajak.
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:manage"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus tarif pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const id = ctx.params?.id;
  if (!id) {
    return ApiErrors.badRequest("ID tarif tidak valid");
  }

  try {
    await getTaxRateConfigService().delete(id, tenantId);
    return apiSuccess({ id }, { message: "Tarif pajak berhasil dihapus" });
  } catch (err) {
    return mapDomainError(err);
  }
});

function mapDomainError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith("CONFLICT:")) {
    return ApiErrors.conflict(message.replace("CONFLICT: ", ""));
  }
  if (message.startsWith("VALIDATION:")) {
    return ApiErrors.badRequest(message.replace("VALIDATION: ", ""));
  }
  if (message.startsWith("NOT_FOUND:")) {
    return ApiErrors.notFound(message.replace("NOT_FOUND: ", ""));
  }
  return ApiErrors.internalError(message);
}
