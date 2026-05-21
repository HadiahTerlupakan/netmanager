import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getPayrollComponentRepository } from "@/modules/salary";
import * as z from "zod";

const componentRepo = getPayrollComponentRepository();

const createComponentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  category: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_COST", "TAX"]),
  calculationType: z.enum([
    "FIXED",
    "PERCENTAGE",
    "FORMULA",
    "PER_HOUR",
    "PER_DAY",
    "PER_UNIT",
  ]),
  taxable: z.boolean().default(true),
  applicableTo: z
    .array(z.enum(["PKWTT", "PKWT", "DAILY", "FREELANCE"]))
    .default(["PKWTT"]),
  isStatutory: z.boolean().default(false),
  formula: z.string().nullable().optional(),
  defaultAmount: z.number().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  description: z.string().nullable().optional(),
});

/** GET /api/admin/salary/components — List payroll components */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat komponen payroll",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const { searchParams } = req.nextUrl;

  const filter = {
    tenantId,
    ...(searchParams.get("category") && {
      category: searchParams.get("category")!,
    }),
    ...(searchParams.get("isActive") && {
      isActive: searchParams.get("isActive") === "true",
    }),
    ...(searchParams.get("isStatutory") && {
      isStatutory: searchParams.get("isStatutory") === "true",
    }),
  } as Parameters<typeof componentRepo.findAll>[0];

  const components = await componentRepo.findAll(filter);

  return apiSuccess({ components });
});

/** POST /api/admin/salary/components — Create a payroll component */
export const POST = createHandler(
  { auth: true, schema: createComponentSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat komponen payroll",
      );
    }

    const tenantId = ctx.session!.user.tenantId!;
    const data = ctx.validated;

    // Check for duplicate code
    const existing = await componentRepo.findByCode(data.code, tenantId);
    if (existing) {
      return ApiErrors.conflict(
        `Komponen dengan kode "${data.code}" sudah ada`,
      );
    }

    const component = await componentRepo.create({
      ...data,
      tenantId,
      formula: data.formula ?? null,
      defaultAmount: data.defaultAmount ?? null,
      description: data.description ?? null,
    });

    return apiSuccess(
      { component },
      { status: 201, message: "Komponen payroll berhasil dibuat" },
    );
  },
);
