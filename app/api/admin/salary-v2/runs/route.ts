import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getPayrollRunRepository } from "@/modules/salary-v2";
import * as z from "zod";

const runRepo = getPayrollRunRepository();

const createRunSchema = z.object({
  scheduleId: z.string().uuid(),
  type: z.enum(["REGULAR", "THR", "BONUS", "RAPEL", "ADVANCE"]),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  payDate: z.string().datetime(),
  notes: z.string().optional(),
});

/** GET /api/admin/salary-v2/runs — List payroll runs */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data payroll",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const { searchParams } = req.nextUrl;

  const filter = {
    tenantId,
    ...(searchParams.get("scheduleId") && {
      scheduleId: searchParams.get("scheduleId")!,
    }),
    ...(searchParams.get("type") && { type: searchParams.get("type")! }),
    ...(searchParams.get("status") && { status: searchParams.get("status")! }),
  } as Parameters<typeof runRepo.findAll>[0];

  const runs = await runRepo.findAll(filter);

  return apiSuccess({ runs });
});

/** POST /api/admin/salary-v2/runs — Create a new payroll run */
export const POST = createHandler(
  { auth: true, schema: createRunSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat payroll run",
      );
    }

    const tenantId = ctx.session!.user.tenantId!;
    const userId = ctx.session!.user.id;
    const { scheduleId, type, periodStart, periodEnd, payDate, notes } =
      ctx.validated;

    const run = await runRepo.create({
      tenantId,
      scheduleId,
      type,
      status: "DRAFT",
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      payDate: new Date(payDate),
      totalEntries: 0,
      totalNetSalary: 0,
      totalEmployerCost: 0,
      lockedAt: null,
      lockedBy: null,
      notes: notes ?? null,
      createdBy: userId,
    });

    return apiSuccess(
      { run },
      { status: 201, message: "Payroll run berhasil dibuat" },
    );
  },
);
