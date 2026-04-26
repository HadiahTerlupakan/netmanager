import { FinanceService } from "@/modules/finance";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import * as z from "zod";
import {
  RabItemCategory,
  RabExpenseType,
  RabGrowthType,
  RabPaymentType,
} from "@prisma/client";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

// Growth settings schemas for different growth types
const linearGrowthSchema = z.object({
  subscribersPerMonth: z.number().min(1),
});

const percentageGrowthSchema = z.object({
  initialPercent: z.number().min(0).max(100),
  monthlyGrowthPercent: z.number().min(0).max(100),
});

const customMilestoneSchema = z.object({
  month: z.number().min(1),
  percent: z.number().min(0).max(100),
});

const customGrowthSchema = z.object({
  milestones: z.array(customMilestoneSchema).min(1),
});

const wbsSchema = z.object({
  id: z.string().optional(), // Frontend temp ID
  name: z.string().min(1),
  order: z.number().default(0),
});

const disbursementSchema = z.object({
  id: z.string().optional(), // Frontend temp ID
  name: z.string().min(1),
  percentage: z.number().min(0).max(100),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(Math.round(Number(v)))),
  estimatedDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  isPaid: z.boolean().default(false),
});

const opexBufferFundingModeSchema = z.enum([
  "INVESTOR",
  "COMPANY",
  "SHARED_PERCENTAGE",
  "FIXED",
]);

const DEFAULT_OPEX_BUFFER_FUNDING_MODE = "INVESTOR";
const SHARED_OPEX_BUFFER_FUNDING_MODE = "SHARED_PERCENTAGE";

type RabOpexBufferFundingModeInput = z.infer<
  typeof opexBufferFundingModeSchema
>;

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(1),
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((v) => BigInt(Math.round(Number(v)))),
  category: z.enum(RabItemCategory).default(RabItemCategory.HARDWARE),
  expenseType: z.enum(RabExpenseType).default(RabExpenseType.CAPEX),
  expenseCategoryId: z.string().optional(),
  wbsGroupId: z.string().optional(),
  disbursements: z.array(disbursementSchema).default([]),
});

function validateOpexBufferSharingPercent(data: {
  opexBufferFundingMode?: RabOpexBufferFundingModeInput;
  opexBufferInvestorPercent?: number;
  opexBufferCompanyPercent?: number;
}) {
  if (data.opexBufferFundingMode !== SHARED_OPEX_BUFFER_FUNDING_MODE) {
    return true;
  }

  return (
    Number(data.opexBufferInvestorPercent || 0) +
      Number(data.opexBufferCompanyPercent || 0) ===
    100
  );
}

const rabSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    siteId: z.string().optional().nullable(),
    mixRadiusGroupId: z.string().optional().nullable(),
    mixRadiusInvestorSiteId: z.string().optional().nullable(),
    projectedRevenue: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((v) => BigInt(Math.round(Number(v)))),
    projectedOpex: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((v) => BigInt(Math.round(Number(v)))),

    // Growth period fields
    targetSubscribers: z.number().optional(),
    arpu: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) =>
        v !== undefined && v !== null && v !== ""
          ? BigInt(Math.round(Number(v)))
          : undefined,
      ),
    growthType: z.enum(RabGrowthType).default(RabGrowthType.LINEAR),
    paymentType: z.enum(RabPaymentType).default(RabPaymentType.PREPAID),
    growthSettings: z
      .union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema])
      .optional(),
    startDate: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    investmentDurationMonths: z.number().min(1).default(12),
    investmentRecoveryType: z
      .enum(["PERCENTAGE", "FIXED"])
      .default("PERCENTAGE"),
    investmentRecoveryValue: z.number().default(50),
    investorProfitSharePercent: z.number().default(50),

    // Enterprise features
    contingencyPercent: z.number().min(0).max(100).default(0),
    contingencyAmount: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((v) => BigInt(Math.round(Number(v)))),
    nplTolerancePercent: z.number().min(0).max(100).default(0),
    opexBufferFundingMode: opexBufferFundingModeSchema.default(
      DEFAULT_OPEX_BUFFER_FUNDING_MODE,
    ),
    opexBufferInvestorPercent: z.number().min(0).max(100).default(100),
    opexBufferCompanyPercent: z.number().min(0).max(100).default(0),
    opexBufferInvestorFixedAmount: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((v) => BigInt(Math.round(Number(v)))),
    opexBufferSafetyPercent: z.number().min(0).max(100).default(0),
    hasDisbursementPlan: z.boolean().default(false),
    wbsGroups: z.array(wbsSchema).default([]),
    investorIds: z.array(z.string()).optional().default([]),

    items: z.array(itemSchema).default([]),
  })
  .refine(validateOpexBufferSharingPercent, {
    message: "Total persentase buffer OPEX investor dan perusahaan harus 100%",
    path: ["opexBufferInvestorPercent"],
  });

// GET: List RAB Projects
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const hasAccess =
    isSuper ||
    (await hasPermission("expense:read")) ||
    (await hasPermission("mixradius_expenses:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read",
    );
  }

  const { searchParams } = req.nextUrl;
  const params = {
    siteId: searchParams.get("siteId"),
    mixRadiusGroupId: searchParams.get("mixRadiusGroupId"),
    mixRadiusInvestorSiteId: searchParams.get("mixRadiusInvestorSiteId"),
    status: searchParams.get("status"),
  };

  const financeService = new FinanceService();
  const projects = await financeService.getRabProjects(params);

  return apiSuccess(projects);
});

// POST: Create RAB Project
export const POST = createHandler(
  {
    auth: true,
    schema: rabSchema,
  },
  async (req, ctx) => {
    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);
    const hasAccess =
      isSuper ||
      (await hasPermission("expense:create")) ||
      (await hasPermission("mixradius_expenses:create"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:create ATAU mixradius_expenses:create",
      );
    }

    const financeService = new FinanceService();
    try {
      const project = await financeService.createRabProject(
        ctx.validated as Parameters<typeof financeService.createRabProject>[0],
        user.id,
      );
      return apiSuccess(project, { status: 201 });
    } catch (error: unknown) {
      return ApiErrors.badRequest(
        error instanceof Error ? error.message : "Gagal membuat proyek RAB",
      );
    }
  },
);
