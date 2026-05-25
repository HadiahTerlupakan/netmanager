import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { getTaxRateConfigService } from "@/modules/tax";
import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tax/rate-configs — list tarif pajak fleksibel.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("tax:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat tarif pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  try {
    const items = await getTaxRateConfigService().list(tenantId);
    return apiSuccess(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(
      `[tax/rate-configs GET] tenantId=${tenantId} message=${message}`,
      err,
      { stack },
    );
    return ApiErrors.internalError(`Gagal memuat tarif pajak: ${message}`);
  }
});

const createSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, "Code hanya boleh huruf besar, angka, underscore"),
  name: z.string().min(1).max(120),
  category: z.enum(["PPN", "PPH", "BHP_USO", "OTHER"]),
  rate: z.number().min(0).max(100),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  dueMonth: z.number().int().min(1).max(12).nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * POST /api/admin/tax/rate-configs — buat tarif pajak baru.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("tax:manage"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menambah tarif pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const validation = await validateRequestBody(req, createSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  try {
    const created = await getTaxRateConfigService().create(
      tenantId,
      validation.data as z.infer<typeof createSchema>,
    );
    return apiSuccess(created, { message: "Tarif pajak berhasil ditambahkan" });
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
