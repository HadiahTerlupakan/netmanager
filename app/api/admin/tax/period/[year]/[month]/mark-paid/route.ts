import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { getTaxPeriodService } from "@/modules/tax";
import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import type { TaxType } from "@/modules/tax";

export const dynamic = "force-dynamic";

const markPaidSchema = z.object({
  taxType: z.enum([
    "PPN_KELUARAN",
    "PPN_MASUKAN",
    "PPH_21",
    "PPH_23",
    "PPH_4_2",
    "BHP",
    "USO",
  ]),
});

/**
 * POST /api/admin/tax/period/[year]/[month]/mark-paid - Mark tax type as paid
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("tax:manage"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengelola pajak",
    );
  }

  const tenantId = ctx.session?.user.tenantId;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const year = parseInt(ctx.params.year, 10);
  const month = parseInt(ctx.params.month, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return ApiErrors.badRequest("Parameter year/month tidak valid");
  }

  const validation = await validateRequestBody(req, markPaidSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const { taxType } = validation.data as z.infer<typeof markPaidSchema>;

  const service = getTaxPeriodService();
  await service.markPaid(tenantId, year, month, taxType as TaxType);
  return apiSuccess(null, {
    message: `Pajak ${taxType} berhasil ditandai sudah setor`,
  });
});
