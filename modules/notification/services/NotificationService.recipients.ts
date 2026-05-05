import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type { UserLookupService } from "@/modules/users";
import type {
  EligibleUser,
  RecipientUser,
} from "./NotificationService.helpers";

const WORK_ORDER_RESOURCE = "workorders";
const WORK_ORDER_READ_ACTION = "read";
const WORK_ORDER_DEPARTMENT_ONLY_ACTION = "department_only";

/** Find work-order recipients allowed by current site and department rules. */
export async function findEligibleRecipients(input: {
  userLookupService: UserLookupService;
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
}): Promise<RecipientUser[]> {
  if (!input.excludeUserId) {
    logger.warn(
      "[NotificationDebug] WARNING: findEligibleRecipients called without excludeUserId.",
    );
  }

  const whereClause = buildEligibleRecipientWhere(input);
  const users =
    await input.userLookupService.findManyWithDetailedRelations(whereClause);
  return users
    .filter((user: EligibleUser) => isEligibleRecipient(user, input))
    .map(mapRecipientUser);
}

/** Find canvasing verifiers for one site scope. */
export async function findCanvasingVerifiers(input: {
  userLookupService: UserLookupService;
  siteId?: string | null;
}): Promise<RecipientUser[]> {
  return input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    role: { permission: { some: { resource: "canvasing", action: "verify" } } },
    ...(input.siteId
      ? {
          OR: [
            { siteId: input.siteId },
            { siteId: null },
            { userSites: { some: { siteId: input.siteId } } },
          ],
        }
      : {}),
  });
}

function buildEligibleRecipientWhere(input: {
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
}): Prisma.UserWhereInput {
  const siteConditions = input.siteId
    ? buildSiteConditions(input.siteId)
    : undefined;
  if (!input.departmentId) {
    return buildSiteScopedRecipientWhere(input.excludeUserId, siteConditions);
  }

  return {
    ...buildEligibleRecipientBaseWhere(input.excludeUserId),
    OR: buildDepartmentScopedConditions(input.departmentId, siteConditions),
  };
}

function buildEligibleRecipientBaseWhere(
  excludeUserId?: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    role: {
      permission: {
        some: { resource: WORK_ORDER_RESOURCE, action: WORK_ORDER_READ_ACTION },
      },
    },
  };
}

function buildSiteScopedRecipientWhere(
  excludeUserId: string | undefined,
  siteConditions?: Prisma.UserWhereInput[],
): Prisma.UserWhereInput {
  return {
    ...buildEligibleRecipientBaseWhere(excludeUserId),
    ...(siteConditions ? { OR: siteConditions } : {}),
  };
}

function buildSiteConditions(siteId: string): Prisma.UserWhereInput[] {
  return [{ siteId }, { siteId: null }, { userSites: { some: { siteId } } }];
}

function buildDepartmentScopedConditions(
  departmentId: string,
  siteConditions?: Prisma.UserWhereInput[],
): Prisma.UserWhereInput[] {
  const departmentConditions: Prisma.UserWhereInput[] = [
    { departmentId },
    { departmentId: null },
    {
      role: {
        permission: {
          none: {
            resource: WORK_ORDER_RESOURCE,
            action: WORK_ORDER_DEPARTMENT_ONLY_ACTION,
          },
        },
      },
    },
  ];

  if (!siteConditions) {
    return departmentConditions;
  }

  return siteConditions.map((siteCondition) => ({
    ...siteCondition,
    OR: departmentConditions,
  }));
}

function isEligibleRecipient(
  user: EligibleUser,
  input: { excludeUserId?: string; siteId?: string },
): boolean {
  if (input.excludeUserId && user.id === input.excludeUserId) {
    return false;
  }
  if (!user.role?.permission?.length || !input.siteId) {
    return true;
  }

  const userSiteIds = user.userSites?.map((userSite) => userSite.siteId) || [];
  return (
    userSiteIds.includes(input.siteId) ||
    user.siteId === input.siteId ||
    user.siteId === null
  );
}

function mapRecipientUser(user: { id: string }): RecipientUser {
  return { id: user.id };
}
