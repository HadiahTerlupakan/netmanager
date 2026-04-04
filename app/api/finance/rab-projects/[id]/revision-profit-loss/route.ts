import { RabExpenseType } from "@prisma/client";

import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { buildRabRevisionVarianceSummary, getVarianceLabel } from "@/modules/finance";
import { prisma } from "@/modules/database";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess =
    isSuperAdmin(user) ||
    (await hasPermission("expense:read")) ||
    (await hasPermission("mixradius_expenses:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read",
    );
  }

  const project = await prisma.rabProject.findUnique({
    where: { id: ctx.params.id },
    include: {
      items: true,
      finalApprovedRevision: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!project) {
    return ApiErrors.notFound("Proyek RAB");
  }

  const expenses = await prisma.expense.findMany({
    where: { rabProjectId: project.id },
    select: {
      id: true,
      amount: true,
      category: true,
      rabItemId: true,
      description: true,
      rabItem: {
        select: {
          id: true,
          expenseType: true,
        },
      },
    },
  });

  const originalCapex = project.items.reduce((sum, item) => {
    if (item.expenseType === RabExpenseType.OPEX) {
      return sum;
    }

    return sum + item.totalPrice;
  }, 0n);
  const originalOpex = project.projectedOpex;
  const finalRevision = project.finalApprovedRevision;
  const finalCapex = finalRevision?.totalCapex ?? originalCapex;
  const finalOpex = finalRevision?.totalOpex ?? originalOpex;

  let actualCapex = 0n;
  let actualOpex = 0n;
  let unmappedRealization = 0n;

  for (const expense of expenses) {
    const expenseType = expense.rabItem?.expenseType ?? expense.category;

    if (expenseType === RabExpenseType.OPEX || expense.category === RabExpenseType.OPEX) {
      actualOpex += expense.amount;
    } else {
      actualCapex += expense.amount;
    }

    if (!expense.rabItemId) {
      unmappedRealization += expense.amount;
    }
  }

  const varianceSummary = buildRabRevisionVarianceSummary({
    originalCapex,
    originalOpex,
    finalCapex,
    finalOpex,
    actualCapex,
    actualOpex,
  });

  const itemActualTotals = new Map<string, bigint>();

  for (const expense of expenses) {
    if (!expense.rabItemId) {
      continue;
    }

    itemActualTotals.set(
      expense.rabItemId,
      (itemActualTotals.get(expense.rabItemId) ?? 0n) + expense.amount,
    );
  }

  const itemVariances = (finalRevision?.items ?? []).map((item) => {
    const actualTotal = itemActualTotals.get(item.rabItemId ?? "") ?? 0n;
    const variance = item.totalPrice - actualTotal;

    return {
      rabItemId: item.rabItemId,
      revisionItemId: item.id,
      name: item.name,
      finalTotal: item.totalPrice.toString(),
      actualTotal: actualTotal.toString(),
      variance: variance.toString(),
      varianceLabel: getVarianceLabel(variance),
    };
  });

  return apiSuccess({
    originalSummary: {
      capex: originalCapex.toString(),
      opex: originalOpex.toString(),
      total: varianceSummary.originalTotal.toString(),
    },
    finalRevisionSummary: finalRevision
      ? {
          id: finalRevision.id,
          capex: finalCapex.toString(),
          opex: finalOpex.toString(),
          total: varianceSummary.finalTotal.toString(),
        }
      : null,
    actualSummary: {
      capex: actualCapex.toString(),
      opex: actualOpex.toString(),
      total: varianceSummary.actualTotal.toString(),
    },
    varianceSummary: {
      capexVariance: varianceSummary.capexVariance.toString(),
      opexVariance: varianceSummary.opexVariance.toString(),
      netVariance: varianceSummary.netVariance.toString(),
      capexLabel: varianceSummary.capexLabel,
      opexLabel: varianceSummary.opexLabel,
      netLabel: varianceSummary.netLabel,
    },
    itemVariances,
    unmappedRealization: unmappedRealization.toString(),
  });
});
