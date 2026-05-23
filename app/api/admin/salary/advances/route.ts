import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getSalaryAdvanceRepository,
  getAdvanceManagementService,
} from "@/modules/salary";
import * as z from "zod";

const advanceRepo = getSalaryAdvanceRepository();
const advanceManagement = getAdvanceManagementService();

const createAdvanceSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  basicSalary: z.number().positive(),
  reason: z.string().nullable().optional(),
  deductionMethod: z.enum(["FULL_NEXT", "INSTALLMENT"]).default("FULL_NEXT"),
  installmentCount: z.number().int().min(1).max(12).nullable().optional(),
});

/** GET /api/admin/salary/advances — List salary advances */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data kasbon",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const { searchParams } = req.nextUrl;

  const filter = {
    tenantId,
    ...(searchParams.get("userId") && { userId: searchParams.get("userId")! }),
    ...(searchParams.get("status") && {
      status: searchParams.get("status")! as
        | "PENDING"
        | "APPROVED"
        | "DISBURSED"
        | "DEDUCTED"
        | "REJECTED",
    }),
  };

  const advances = await advanceRepo.findAll(filter);

  return apiSuccess({ advances });
});

/** POST /api/admin/salary/advances — Create advance on behalf of employee */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat kasbon",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const body = await req.json();
  const parsed = createAdvanceSchema.safeParse(body);

  if (!parsed.success) {
    return ApiErrors.badRequest(parsed.error.message);
  }

  const {
    userId,
    amount,
    basicSalary,
    reason,
    deductionMethod,
    installmentCount,
  } = parsed.data;

  const result = await advanceManagement.requestAdvance({
    tenantId,
    userId,
    amount,
    basicSalary,
    reason: reason ?? null,
    deductionMethod,
    installmentCount: installmentCount ?? null,
  });

  if (!result.success) {
    return ApiErrors.badRequest(result.message);
  }

  return apiSuccess({ advance: result.advance }, { message: result.message });
});
