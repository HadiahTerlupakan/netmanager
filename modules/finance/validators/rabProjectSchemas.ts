import * as z from "zod";
import {
  RabExpenseType,
  RabGrowthType,
  RabItemCategory,
  RabPaymentType,
} from "@prisma/client";

const DEFAULT_OPEX_BUFFER_FUNDING_MODE = "INVESTOR";
const SHARED_OPEX_BUFFER_FUNDING_MODE = "SHARED_PERCENTAGE";

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
  id: z.string().optional(),
  name: z.string().min(1),
  order: z.number().default(0),
});

const disbursementSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  percentage: z.number().min(0).max(100),
  amount: z
    .union([z.string(), z.number()])
    .transform((value) => BigInt(Math.round(Number(value)))),
  estimatedDate: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  isPaid: z.boolean().default(false),
});

const rabTargetBasisSchema = z.enum(["HOMECONNECT", "HOMEPASS"]);
const rabInvestorProfitShareModeSchema = z.enum(["FLAT", "TIERED_AFTER_BEP"]);
const opexBufferFundingModeSchema = z.enum([
  "INVESTOR",
  "COMPANY",
  "SHARED_PERCENTAGE",
  "FIXED",
]);

type RabOpexBufferFundingModeInput = z.infer<
  typeof opexBufferFundingModeSchema
>;

const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(1),
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((value) => BigInt(Math.round(Number(value)))),
  category: z.enum(RabItemCategory).default(RabItemCategory.HARDWARE),
  expenseType: z.enum(RabExpenseType).default(RabExpenseType.CAPEX),
  expenseCategoryId: z.string().optional(),
  wbsGroupId: z.string().optional(),
  disbursements: z.array(disbursementSchema).default([]),
});

const updateItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((value) => BigInt(Math.round(Number(value)))),
  category: z.enum(RabItemCategory),
  expenseType: z.enum(RabExpenseType).default(RabExpenseType.CAPEX),
  expenseCategoryId: z.string().optional(),
  wbsGroupId: z.string().optional(),
  disbursements: z.array(disbursementSchema).optional(),
});

function optionalBigInt(value: string | number | undefined) {
  return value !== undefined && value !== null && value !== ""
    ? BigInt(Math.round(Number(value)))
    : undefined;
}

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

export const rabProjectCreateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    siteId: z.string().optional().nullable(),
    mixRadiusGroupId: z.string().optional().nullable(),
    mixRadiusInvestorSiteId: z.string().optional().nullable(),
    projectedRevenue: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((value) => BigInt(Math.round(Number(value)))),
    projectedOpex: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((value) => BigInt(Math.round(Number(value)))),
    targetBasis: rabTargetBasisSchema.default("HOMECONNECT"),
    targetHomepass: z.number().min(0).optional(),
    targetTakeUpRatePercent: z.number().min(0).max(100).default(100),
    targetSubscribers: z.number().optional(),
    arpu: z
      .union([z.string(), z.number()])
      .optional()
      .transform(optionalBigInt),
    growthType: z.enum(RabGrowthType).default(RabGrowthType.LINEAR),
    paymentType: z.enum(RabPaymentType).default(RabPaymentType.PREPAID),
    growthSettings: z
      .union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema])
      .optional(),
    startDate: z
      .string()
      .optional()
      .transform((value) => (value ? new Date(value) : undefined)),
    investmentDurationMonths: z.number().min(1).default(12),
    investmentRecoveryType: z
      .enum(["PERCENTAGE", "FIXED"])
      .default("PERCENTAGE"),
    investmentRecoveryValue: z.number().default(50),
    investorProfitSharePercent: z.number().min(0).max(100).default(50),
    investorProfitShareMode: rabInvestorProfitShareModeSchema.default("FLAT"),
    investorProfitShareBeforeBepPercent: z.number().min(0).max(100).default(80),
    investorProfitShareAfterBepPercent: z.number().min(0).max(100).default(60),
    contingencyPercent: z.number().min(0).max(100).default(0),
    contingencyAmount: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((value) => BigInt(Math.round(Number(value)))),
    nplTolerancePercent: z.number().min(0).max(100).default(0),
    opexBufferFundingMode: opexBufferFundingModeSchema.default(
      DEFAULT_OPEX_BUFFER_FUNDING_MODE,
    ),
    opexBufferInvestorPercent: z.number().min(0).max(100).default(100),
    opexBufferCompanyPercent: z.number().min(0).max(100).default(0),
    opexBufferInvestorFixedAmount: z
      .union([z.string(), z.number()])
      .default(0)
      .transform((value) => BigInt(Math.round(Number(value)))),
    opexBufferSafetyPercent: z.number().min(0).max(100).default(0),
    hasDisbursementPlan: z.boolean().default(false),
    wbsGroups: z.array(wbsSchema).default([]),
    investorIds: z.array(z.string()).optional().default([]),
    items: z.array(createItemSchema).default([]),
  })
  .refine(validateOpexBufferSharingPercent, {
    message: "Total persentase buffer OPEX investor dan perusahaan harus 100%",
    path: ["opexBufferInvestorPercent"],
  });

export const rabProjectUpdateSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    siteId: z.string().nullable().optional(),
    mixRadiusGroupId: z.string().nullable().optional(),
    mixRadiusInvestorSiteId: z.string().nullable().optional(),
    status: z
      .enum([
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "PENGADAAN",
        "PENGGELARAN_JARINGAN",
        "PENJUALAN",
        "TARGET_TERCAPAI",
        "SELESAI",
        "CANCELLED",
      ])
      .optional(),
    projectedRevenue: z
      .union([z.string(), z.number()])
      .optional()
      .transform(optionalBigInt),
    projectedOpex: z
      .union([z.string(), z.number()])
      .optional()
      .transform(optionalBigInt),
    targetBasis: rabTargetBasisSchema.optional(),
    targetHomepass: z.number().min(0).optional(),
    targetTakeUpRatePercent: z.number().min(0).max(100).optional(),
    targetSubscribers: z.number().optional(),
    arpu: z
      .union([z.string(), z.number()])
      .optional()
      .transform(optionalBigInt),
    growthType: z.enum(RabGrowthType).optional(),
    paymentType: z.enum(RabPaymentType).optional(),
    growthSettings: z
      .union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema])
      .optional(),
    startDate: z
      .string()
      .optional()
      .transform((value) => (value ? new Date(value) : undefined)),
    investmentDurationMonths: z.number().min(1).optional(),
    investmentRecoveryType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
    investmentRecoveryValue: z.number().optional(),
    investorProfitSharePercent: z.number().min(0).max(100).optional(),
    investorProfitShareMode: rabInvestorProfitShareModeSchema.optional(),
    investorProfitShareBeforeBepPercent: z.number().min(0).max(100).optional(),
    investorProfitShareAfterBepPercent: z.number().min(0).max(100).optional(),
    contingencyPercent: z.number().min(0).max(100).optional(),
    contingencyAmount: z
      .union([z.string(), z.number()])
      .optional()
      .transform(optionalBigInt),
    nplTolerancePercent: z.number().min(0).max(100).optional(),
    opexBufferFundingMode: opexBufferFundingModeSchema.optional(),
    opexBufferInvestorPercent: z.number().min(0).max(100).optional(),
    opexBufferCompanyPercent: z.number().min(0).max(100).optional(),
    opexBufferInvestorFixedAmount: z
      .union([z.string(), z.number()])
      .optional()
      .transform(optionalBigInt),
    opexBufferSafetyPercent: z.number().min(0).max(100).optional(),
    hasDisbursementPlan: z.boolean().optional(),
    wbsGroups: z.array(wbsSchema).optional(),
    investorIds: z.array(z.string()).optional(),
    items: z.array(updateItemSchema).optional(),
  })
  .refine(validateOpexBufferSharingPercent, {
    message: "Total persentase buffer OPEX investor dan perusahaan harus 100%",
    path: ["opexBufferInvestorPercent"],
  })
  .refine((value) => value.status !== "APPROVED", {
    message: "Perubahan approval harus melalui endpoint approval",
    path: ["status"],
  });
