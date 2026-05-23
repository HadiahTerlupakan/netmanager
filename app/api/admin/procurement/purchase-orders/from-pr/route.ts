import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  type GeneratePOFromPRInput,
  generatePOFromPRSchema,
  getProcurementService,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/procurement/purchase-orders/from-pr
 * Batch generate Purchase Order dari sekumpulan Purchase Request APPROVED.
 * Berbeda dari auto-generate di restock approve (1 PR per call) — endpoint ini
 * dipakai admin procurement untuk konsolidasi multi-PR.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("purchase_orders:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat purchase order",
    );
  }

  const userId = ctx.session?.user.id;
  if (!userId) {
    return ApiErrors.unauthorized("Sesi tidak valid");
  }

  const validation = await validateRequestBody(req, generatePOFromPRSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const data = validation.data as GeneratePOFromPRInput;
  try {
    const purchaseOrders = await getProcurementService().generatePOFromPRs(
      data.prIds,
      userId,
      data.overrideSupplierId ?? undefined,
    );

    return apiSuccess(purchaseOrders, {
      message: `${purchaseOrders.length} Purchase Order berhasil dibuat`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat Purchase Order";
    return ApiErrors.badRequest(message);
  }
});
