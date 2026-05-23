import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getSalaryAdvanceRepository,
  getAdvanceManagementService,
} from "@/modules/salary";
import * as z from "zod";

const advanceRepo = getSalaryAdvanceRepository();
const advanceManagement = getAdvanceManagementService();

const updateAdvanceSchema = z.object({
  action: z.enum(["approve", "reject", "disburse"]),
  rejectionReason: z.string().optional(),
  accountId: z.string().optional(),
});

/** GET /api/admin/salary/advances/[id] — Get advance detail */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kasbon",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;

  const advance = await advanceRepo.findById(id, tenantId);
  if (!advance) {
    return ApiErrors.notFound("Kasbon");
  }

  return apiSuccess({ advance });
});

/** PUT /api/admin/salary/advances/[id] — Approve/Reject/Disburse */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah status kasbon",
    );
  }

  const { id } = ctx.params;
  const tenantId = ctx.session!.user.tenantId!;
  const userId = ctx.session!.user.id!;
  const body = await req.json();

  const parsed = updateAdvanceSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(parsed.error.message);
  }

  const { action, rejectionReason, accountId } = parsed.data;

  let result;
  switch (action) {
    case "approve":
      result = await advanceManagement.approve(id, tenantId, userId);
      break;
    case "reject":
      result = await advanceManagement.reject(
        id,
        tenantId,
        rejectionReason ?? "Ditolak oleh admin",
      );
      break;
    case "disburse":
      result = await advanceManagement.disburse(id, tenantId, accountId);
      break;
  }

  if (!result.success) {
    return ApiErrors.badRequest(result.message);
  }

  return apiSuccess({ advance: result.advance }, { message: result.message });
});
