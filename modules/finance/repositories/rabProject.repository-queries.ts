import { RabStatus, type Prisma } from "@prisma/client";

const PROJECT_ITEM_INCLUDE = { include: { disbursements: true } };
const PROJECT_DETAIL_REVISION_SELECT = {
  id: true,
  revisionNumber: true,
  status: true,
};
const PROJECT_DETAIL_COUNT_SELECT = { revisions: true };
const PROJECT_DETAIL_INCLUDE = {
  items: PROJECT_ITEM_INCLUDE,
  wbsGroups: true,
  actualAchievements: { orderBy: [{ year: "asc" }, { month: "asc" }] },
  site: { select: { name: true } },
  creator: { select: { name: true } },
  investors: true,
  revisions: {
    select: PROJECT_DETAIL_REVISION_SELECT,
    orderBy: { revisionNumber: "desc" },
    take: 1,
  },
  _count: { select: PROJECT_DETAIL_COUNT_SELECT },
} satisfies Prisma.RabProjectInclude;
const PROJECT_LIST_INCLUDE = {
  items: {
    orderBy: [{ wbsId: "asc" }, { id: "asc" }],
    include: {
      disbursements: { orderBy: [{ estimatedDate: "asc" }, { id: "asc" }] },
      expenseCategory: { include: { parent: true } },
    },
  },
  wbsGroups: { orderBy: [{ order: "asc" }, { id: "asc" }] },
  site: { select: { name: true } },
  investors: { orderBy: { id: "asc" } },
  creator: { select: { name: true } },
  approvals: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { name: true } },
        },
      },
    },
  },
  revisions: {
    select: PROJECT_DETAIL_REVISION_SELECT,
    orderBy: { revisionNumber: "desc" },
    take: 1,
  },
  _count: { select: PROJECT_DETAIL_COUNT_SELECT },
} satisfies Prisma.RabProjectInclude;
const PROJECT_STATUS_EVALUATION_INCLUDE = {
  actualAchievements: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.RabProjectInclude;
const PROJECT_STATUS_EVALUATION_WHERE = {
  status: { in: ["PENJUALAN", "TARGET_TERCAPAI"] },
} satisfies Prisma.RabProjectWhereInput;
const PROJECT_LIST_ORDER_BY = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.RabProjectOrderByWithRelationInput[];
const DUPLICATE_ITEM_INCLUDE = {
  items: true,
} satisfies Prisma.RabProjectInclude;
const REVISION_PROFIT_LOSS_INCLUDE = {
  items: true,
  finalApprovedRevision: {
    include: { items: { orderBy: { sortOrder: "asc" } } },
  },
} satisfies Prisma.RabProjectInclude;
const FULL_PROJECT_RESULT_INCLUDE = {
  items: PROJECT_ITEM_INCLUDE,
  wbsGroups: true,
} satisfies Prisma.RabProjectInclude;

export const DEFAULT_DUPLICATE_PROJECT_STATUS = RabStatus.DRAFT;
export const duplicateProjectInclude = DUPLICATE_ITEM_INCLUDE;
export const fullProjectResultInclude = FULL_PROJECT_RESULT_INCLUDE;

/** Builds a status update payload for simple project transitions. */
export function createStatusUpdateData(status: RabStatus) {
  return {
    status,
    updatedAt: new Date(),
  } satisfies Prisma.RabProjectUpdateInput;
}

/** Builds query args for project status evaluation. */
export function createProjectStatusEvaluationQuery() {
  return {
    where: PROJECT_STATUS_EVALUATION_WHERE,
    include: PROJECT_STATUS_EVALUATION_INCLUDE,
  } satisfies Prisma.RabProjectFindManyArgs;
}

/** Builds query args for detailed project list responses. */
export function createProjectListQuery(where: Prisma.RabProjectWhereInput) {
  return {
    where,
    orderBy: PROJECT_LIST_ORDER_BY,
    include: PROJECT_LIST_INCLUDE,
  } satisfies Prisma.RabProjectFindManyArgs;
}

/** Builds query args for project detail responses. */
export function createProjectDetailQuery(id: string) {
  return {
    where: { id },
    include: PROJECT_DETAIL_INCLUDE,
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds query args for project item detail responses. */
export function createProjectWithItemsQuery(id: string) {
  return {
    where: { id },
    include: { items: PROJECT_ITEM_INCLUDE, wbsGroups: true },
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds query args for revision profit-loss analysis. */
export function createRevisionProfitLossQuery(id: string) {
  return {
    where: { id },
    include: REVISION_PROFIT_LOSS_INCLUDE,
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds query args for project duplication source lookup. */
export function createProjectDuplicateQuery(id: string) {
  return {
    where: { id },
    include: DUPLICATE_ITEM_INCLUDE,
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds a minimal project lookup query by id. */
export function createBasicProjectQuery(id: string) {
  return { where: { id } } satisfies Prisma.RabProjectFindUniqueArgs;
}
