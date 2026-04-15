import { prisma } from "@/modules/database";
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
import { RabProjectRepository } from "@/modules/finance";

export const dynamic = "force-dynamic";

// Growth settings schemas
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
    .transform((v) => BigInt(Math.round(Number(v)))),
  estimatedDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  isPaid: z.boolean().default(false),
});

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

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

  const project = await prisma.rabProject.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          disbursements: true,
        },
      },
      wbsGroups: true,
      actualAchievements: {
        orderBy: [{ year: "asc" }, { month: "asc" }],
      },
      site: { select: { name: true } },
      creator: { select: { name: true } },
      investors: true,
      revisions: {
        select: {
          id: true,
          revisionNumber: true,
          status: true,
        },
        orderBy: { revisionNumber: "desc" },
        take: 1,
      },
      _count: {
        select: {
          revisions: true,
        },
      },
    },
  });

  if (!project) {
    return ApiErrors.notFound("Proyek RAB");
  }

  const { revisions, _count, ...projectData } = project;
  const serialized = {
    ...projectData,
    projectedRevenue: project.projectedRevenue.toString(),
    projectedOpex: project.projectedOpex.toString(),
    arpu: project.arpu?.toString() || null,
    contingencyAmount: project.contingencyAmount?.toString() || "0",
    revisionCount: _count?.revisions || 0,
    latestRevision: revisions?.[0] || null,
    items: project.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      disbursements: (item.disbursements || []).map((disbursement) => ({
        ...disbursement,
        amount: disbursement.amount.toString(),
      })),
    })),
    actualAchievements: project.actualAchievements.map((achievement) => ({
      ...achievement,
      actualRevenue: achievement.actualRevenue.toString(),
      actualOpex: achievement.actualOpex.toString(),
    })),
  };

  return apiSuccess(serialized);
});

const updateSchema = z.object({
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
    .transform((v) =>
      v !== undefined && v !== null && v !== ""
        ? BigInt(Math.round(Number(v)))
        : undefined,
    ),
  projectedOpex: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) =>
      v !== undefined && v !== null && v !== ""
        ? BigInt(Math.round(Number(v)))
        : undefined,
    ),

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
  growthType: z.enum(RabGrowthType).optional(),
  paymentType: z.enum(RabPaymentType).optional(),
  growthSettings: z
    .union([linearGrowthSchema, percentageGrowthSchema, customGrowthSchema])
    .optional(),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  investmentDurationMonths: z.number().min(1).optional(),
  investmentRecoveryType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  investmentRecoveryValue: z.number().optional(),
  investorProfitSharePercent: z.number().optional(),

  // Enterprise features
  contingencyPercent: z.number().min(0).max(100).optional(),
  contingencyAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) =>
      v !== undefined && v !== null && v !== ""
        ? BigInt(Math.round(Number(v)))
        : undefined,
    ),
  nplTolerancePercent: z.number().min(0).max(100).optional(),
  hasDisbursementPlan: z.boolean().optional(),
  wbsGroups: z.array(wbsSchema).optional(),
  investorIds: z.array(z.string()).optional(),

  items: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        quantity: z.number(),
        unitPrice: z
          .union([z.string(), z.number()])
          .transform((v) => BigInt(Math.round(Number(v)))),
        category: z.enum(RabItemCategory),
        expenseType: z.enum(RabExpenseType).default(RabExpenseType.CAPEX),
        expenseCategoryId: z.string().optional(),
        wbsGroupId: z.string().optional(),
        disbursements: z.array(disbursementSchema).optional(),
      }),
    )
    .optional(),
});

export const PATCH = createHandler(
  {
    auth: true,
    schema: updateSchema,
  },
  async (_req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    const isSuper = isSuperAdmin(user);
    const hasAccess =
      isSuper ||
      (await hasPermission("expense:update")) ||
      (await hasPermission("mixradius_expenses:update"));

    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: expense:update ATAU mixradius_expenses:update",
      );
    }

    const rabProjectRepository = new RabProjectRepository();

    const project = await rabProjectRepository.updateProjectWithRelations(
      id,
      ctx.validated,
    );

    if (!project) return ApiErrors.notFound("Proyek RAB");

    const serialized = {
      ...project,
      projectedRevenue: project.projectedRevenue.toString(),
      projectedOpex: project.projectedOpex.toString(),
      arpu: project.arpu?.toString() || null,
      contingencyAmount: project.contingencyAmount?.toString() || "0",
      items: project.items.map((i) => ({
        ...i,
        unitPrice: i.unitPrice.toString(),
        totalPrice: i.totalPrice.toString(),
        disbursements: (i.disbursements || []).map((d) => ({
          ...d,
          amount: d.amount.toString(),
        })),
      })),
    };

    return apiSuccess(serialized);
  },
);

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  const isSuper = isSuperAdmin(user);
  const hasAccess =
    isSuper ||
    (await hasPermission("expense:delete")) ||
    (await hasPermission("mixradius_expenses:delete"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:delete ATAU mixradius_expenses:delete",
    );
  }

  const project = await prisma.rabProject.findUnique({
    where: { id },
  });

  if (!project) {
    return ApiErrors.notFound("Proyek RAB");
  }

  if (project.status !== "DRAFT") {
    return ApiErrors.badRequest(
      "Hanya proyek RAB dengan status DRAFT yang dapat dihapus",
    );
  }

  await prisma.$transaction([
    // Delete non-cascading relations
    prisma.rabInvestor.deleteMany({
      where: { rabProjectId: id },
    }),
    // Nullify expense relations
    prisma.expense.updateMany({
      where: { rabProjectId: id },
      data: { rabProjectId: null },
    }),
    // Delete the core project (others use onDelete: Cascade)
    prisma.rabProject.delete({
      where: { id },
    }),
  ]);

  return apiSuccess({ success: true });
});
