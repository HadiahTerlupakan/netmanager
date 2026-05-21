import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { getTaxConfigService } from "@/modules/tax";
import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/config - Get tax configuration for tenant
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat konfigurasi pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const service = getTaxConfigService();
  const config = await service.getConfig(tenantId);
  return apiSuccess(config);
});

const updateConfigSchema = z.object({
  npwp: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  isPkp: z.boolean().optional(),
  ppnRate: z.number().min(0).max(100).optional(),
  ppnIncluded: z.boolean().optional(),
  pph23RateJasa: z.number().min(0).max(100).optional(),
  pph23RateSewa: z.number().min(0).max(100).optional(),
  pph4Rate: z.number().min(0).max(100).optional(),
  bhpRate: z.number().min(0).max(100).optional(),
  usoRate: z.number().min(0).max(100).optional(),
  ksoRate: z.number().min(0).max(100).optional(),
  ppnDueDay: z.number().int().min(1).max(31).optional(),
  pph21DueDay: z.number().int().min(1).max(31).optional(),
  pph23DueDay: z.number().int().min(1).max(31).optional(),
  bhpDueMonth: z.number().int().min(1).max(12).optional(),
});

/**
 * PUT /api/admin/tax/config - Update tax configuration
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("tax:manage"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah konfigurasi pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const validation = await validateRequestBody(req, updateConfigSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const service = getTaxConfigService();
  const config = await service.updateConfig(
    tenantId,
    validation.data as z.infer<typeof updateConfigSchema>,
  );
  return apiSuccess(config, { message: "Konfigurasi pajak berhasil disimpan" });
});
