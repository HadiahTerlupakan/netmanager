const DEFAULT_CONTINGENCY = "0";
const EMPTY_ITEM_ID = "";

type ItemWithDisbursements = {
  unitPrice: bigint;
  totalPrice: bigint;
  disbursements?: Array<{ amount: bigint }>;
};

type AchievementRecord = {
  actualRevenue: bigint;
  actualOpex: bigint;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
};

/** Serializes bigint project amount fields for route responses. */
function serializeProjectAmounts(project: {
  projectedRevenue: bigint;
  projectedOpex: bigint;
  arpu: bigint | null;
  contingencyAmount?: bigint | null;
  opexBufferInvestorFixedAmount?: bigint | null;
}) {
  return {
    projectedRevenue: project.projectedRevenue.toString(),
    projectedOpex: project.projectedOpex.toString(),
    arpu: project.arpu?.toString() || null,
    contingencyAmount:
      project.contingencyAmount?.toString() || DEFAULT_CONTINGENCY,
    opexBufferInvestorFixedAmount:
      project.opexBufferInvestorFixedAmount?.toString() || DEFAULT_CONTINGENCY,
  };
}

/** Serializes nested project items and disbursements. */
function serializeProjectItems(items: ItemWithDisbursements[]) {
  return items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice.toString(),
    totalPrice: item.totalPrice.toString(),
    disbursements: (item.disbursements || []).map((disbursement) => ({
      ...disbursement,
      amount: disbursement.amount.toString(),
    })),
  }));
}

/** Serializes actual achievement records with bigint fields. */
function serializeActualAchievements(achievements: AchievementRecord[]) {
  return achievements.map((achievement) => ({
    ...achievement,
    actualRevenue: achievement.actualRevenue.toString(),
    actualOpex: achievement.actualOpex.toString(),
    manualRecoveryInstallment:
      achievement.manualRecoveryInstallment?.toString() || null,
    manualInvestorShare: achievement.manualInvestorShare?.toString() || null,
    manualCompanyShare: achievement.manualCompanyShare?.toString() || null,
  }));
}

/** Serializes a project detail payload for route responses. */
export function serializeProjectDetail(
  project: {
    projectedRevenue: bigint;
    projectedOpex: bigint;
    arpu: bigint | null;
    contingencyAmount: bigint | null;
    opexBufferInvestorFixedAmount: bigint | null;
    revisions?: unknown[];
    _count?: { revisions: number };
    items: ItemWithDisbursements[];
    actualAchievements?: AchievementRecord[];
  } & Record<string, unknown>,
) {
  const { revisions, _count, ...projectData } = project;

  return {
    ...projectData,
    ...serializeProjectAmounts(project),
    revisionCount: _count?.revisions || 0,
    latestRevision: revisions?.[0] || null,
    items: serializeProjectItems(project.items),
    actualAchievements: serializeActualAchievements(
      project.actualAchievements || [],
    ),
  };
}

/** Serializes an updated project payload for route responses. */
export function serializeUpdatedProject(
  project: {
    projectedRevenue: bigint;
    projectedOpex: bigint;
    arpu: bigint | null;
    contingencyAmount: bigint | null;
    opexBufferInvestorFixedAmount: bigint | null;
    items: ItemWithDisbursements[];
  } & Record<string, unknown>,
) {
  return {
    ...project,
    ...serializeProjectAmounts(project),
    items: serializeProjectItems(project.items),
  };
}

/** Serializes a duplicated project payload for route responses. */
export function serializeDuplicatedProject(
  project: {
    projectedRevenue: bigint;
    projectedOpex: bigint;
    arpu: bigint | null;
    items?: Array<{ unitPrice: bigint; totalPrice: bigint }>;
  } & Record<string, unknown>,
) {
  return {
    ...project,
    projectedRevenue: project.projectedRevenue.toString(),
    projectedOpex: project.projectedOpex.toString(),
    arpu: project.arpu?.toString() || null,
    items: (project.items ?? []).map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
    })),
  };
}

/** Serializes actual achievement upsert responses for route payloads. */
export function serializeAchievement(
  achievement: {
    actualRevenue: bigint;
    actualOpex: bigint;
    manualRecoveryInstallment: bigint | null;
    manualInvestorShare: bigint | null;
    manualCompanyShare: bigint | null;
    manualInvestorProfitSharePercent: number | null;
  } & Record<string, unknown>,
) {
  return {
    ...achievement,
    actualRevenue: achievement.actualRevenue.toString(),
    actualOpex: achievement.actualOpex.toString(),
    manualRecoveryInstallment:
      achievement.manualRecoveryInstallment?.toString() || null,
    manualInvestorShare: achievement.manualInvestorShare?.toString() || null,
    manualCompanyShare: achievement.manualCompanyShare?.toString() || null,
    manualInvestorProfitSharePercent:
      achievement.manualInvestorProfitSharePercent,
  };
}

/** Builds item actual total map for revision variance calculations. */
export function buildItemActualTotals(
  expenses: Array<{ rabItemId?: string | null; amount: bigint }>,
) {
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

  return itemActualTotals;
}

/** Gets a stable item key for variance lookup. */
export function getItemActualTotal(
  itemActualTotals: Map<string, bigint>,
  rabItemId?: string | null,
) {
  return itemActualTotals.get(rabItemId ?? EMPTY_ITEM_ID) ?? 0n;
}
