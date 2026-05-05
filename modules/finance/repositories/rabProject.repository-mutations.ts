import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  FullProjectCreateInput,
  DuplicateProjectSource,
  RabProjectWithDetails,
  TransactionClient,
} from "./rabProject.repository-helpers";
import {
  buildFullProjectCreateData,
  createProjectInvestors,
  createProjectItems,
  createProjectWbsGroups,
} from "./rabProject.create-helpers";
import {
  DEFAULT_DUPLICATE_PROJECT_STATUS,
  duplicateProjectInclude,
  fullProjectResultInclude,
} from "./rabProject.repository-queries";

/** Builds delete transaction steps for draft project removal. */
export function createDraftProjectDeleteTransaction(
  client: PrismaClient,
  id: string,
) {
  return [
    client.rabInvestor.deleteMany({ where: { rabProjectId: id } }),
    client.expense.updateMany({
      where: { rabProjectId: id },
      data: { rabProjectId: null },
    }),
    client.rabProject.delete({ where: { id } }),
  ] as const;
}

/** Builds the upsert payload for actual achievement rows. */
export function buildActualAchievementUpsertArgs(input: {
  rabProjectId: string;
  month: number;
  year: number;
  actualSubscribers: number;
  actualRevenue: bigint;
  actualOpex: bigint;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
  manualInvestorProfitSharePercent: number | null;
  notes?: string;
}) {
  return {
    where: createActualAchievementWhere(input),
    create: input,
    update: createActualAchievementUpdate(input),
  };
}

/** Creates a full project inside an open Prisma transaction. */
export async function createFullProjectInTransaction(
  tx: TransactionClient,
  data: FullProjectCreateInput,
) {
  const project = await tx.rabProject.create({
    data: buildFullProjectCreateData(data),
  });
  const wbsMap = await createProjectWbsGroups(tx, project.id, data.wbsGroups);

  if (data.items.length > 0) {
    await createProjectItems({
      tx,
      projectId: project.id,
      items: data.items,
      wbsMap,
    });
  }

  if (data.investorIds.length > 0) {
    await createProjectInvestors(tx, project.id, data);
  }

  return tx.rabProject.findUnique({
    where: { id: project.id },
    include: fullProjectResultInclude,
  }) as Promise<RabProjectWithDetails | null>;
}

/** Normalizes duplicated project creation args from a source project. */
export function buildDuplicateProjectCreateArgs(
  sourceProject: DuplicateProjectSource,
  userId: string,
) {
  return {
    data: createDuplicateProjectData(sourceProject, userId),
    include: duplicateProjectInclude,
  } satisfies Prisma.RabProjectCreateArgs;
}

function createActualAchievementWhere(input: {
  rabProjectId: string;
  month: number;
  year: number;
}) {
  return {
    rabProjectId_month_year: {
      rabProjectId: input.rabProjectId,
      month: input.month,
      year: input.year,
    },
  };
}

function createActualAchievementUpdate(input: {
  actualSubscribers: number;
  actualRevenue: bigint;
  actualOpex: bigint;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
  manualInvestorProfitSharePercent: number | null;
  notes?: string;
}) {
  const {
    actualSubscribers,
    actualRevenue,
    actualOpex,
    manualRecoveryInstallment,
    manualInvestorShare,
    manualCompanyShare,
    manualInvestorProfitSharePercent,
    notes,
  } = input;
  return {
    actualSubscribers,
    actualRevenue,
    actualOpex,
    manualRecoveryInstallment,
    manualInvestorShare,
    manualCompanyShare,
    manualInvestorProfitSharePercent,
    notes,
  };
}

function createDuplicateProjectData(
  sourceProject: DuplicateProjectSource,
  userId: string,
) {
  return {
    name: `(Copy) ${sourceProject.name}`,
    description: sourceProject.description,
    site: { connect: { id: sourceProject.siteId } },
    mixRadiusGroupId: sourceProject.mixRadiusGroupId,
    projectedRevenue: sourceProject.projectedRevenue,
    projectedOpex: sourceProject.projectedOpex,
    targetSubscribers: sourceProject.targetSubscribers,
    arpu: sourceProject.arpu,
    growthType: sourceProject.growthType,
    paymentType: sourceProject.paymentType,
    growthSettings: sourceProject.growthSettings as Prisma.InputJsonValue,
    startDate: sourceProject.startDate,
    investmentDurationMonths: sourceProject.investmentDurationMonths,
    investmentRecoveryType: sourceProject.investmentRecoveryType,
    investmentRecoveryValue: sourceProject.investmentRecoveryValue,
    investorProfitSharePercent: sourceProject.investorProfitSharePercent,
    investorProfitShareMode: sourceProject.investorProfitShareMode,
    investorProfitShareBeforeBepPercent:
      sourceProject.investorProfitShareBeforeBepPercent,
    investorProfitShareAfterBepPercent:
      sourceProject.investorProfitShareAfterBepPercent,
    nplTolerancePercent: sourceProject.nplTolerancePercent,
    status: DEFAULT_DUPLICATE_PROJECT_STATUS,
    creator: { connect: { id: userId } },
    items: { create: createDuplicateProjectItems(sourceProject) },
  };
}

function createDuplicateProjectItems(sourceProject: DuplicateProjectSource) {
  return sourceProject.items.map((item) => ({
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    category: item.category,
    expenseType: item.expenseType,
  }));
}
