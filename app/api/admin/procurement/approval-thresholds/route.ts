import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getApprovalThresholdService,
  createApprovalThresholdSchema,
  approvalThresholdListQuerySchema,
  toApprovalThresholdDTO,
  ApprovalThresholdInvalidError,
  type CreateApprovalThresholdInput,
  type ApprovalThresholdScope,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/approval-thresholds
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("procurement:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat approval threshold",
    );
  }

  const url = new URL(req.url);
  const queryParse = approvalThresholdListQuerySchema.safeParse({
    scope: url.searchParams.get("scope") ?? undefined,
    isActive: url.searchParams.get("isActive") ?? undefined,
    roleId: url.searchParams.get("roleId") ?? undefined,
  });
  if (!queryParse.success) {
    return ApiErrors.badRequest(
      queryParse.error.issues.map((i) => i.message).join(", "),
    );
  }

  const tenantId = ctx.session?.user.tenantId ?? null;
  const items = await getApprovalThresholdService().list({
    tenantId,
    scope: queryParse.data.scope as ApprovalThresholdScope | undefined,
    isActive: queryParse.data.isActive,
    roleId: queryParse.data.roleId,
  });
  return apiSuccess(items.map(toApprovalThresholdDTO));
});

/**
 * POST /api/admin/procurement/approval-thresholds
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("procurement:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat approval threshold",
    );
  }

  const validation = await validateRequestBody(
    req,
    createApprovalThresholdSchema,
  );
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const data = validation.data as CreateApprovalThresholdInput;
  const tenantId = ctx.session?.user.tenantId ?? null;
  try {
    const created = await getApprovalThresholdService().create({
      scope: data.scope as ApprovalThresholdScope,
      roleId: data.roleId,
      minAmount: data.minAmount,
      maxAmount: data.maxAmount ?? null,
      description: data.description ?? null,
      isActive: data.isActive,
      tenantId,
    });
    return apiSuccess(toApprovalThresholdDTO(created), {
      message: "Approval threshold berhasil dibuat",
    });
  } catch (error) {
    if (error instanceof ApprovalThresholdInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    throw error;
  }
});
