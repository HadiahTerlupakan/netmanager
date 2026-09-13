import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserLookupService } from "@/modules/users";
import type {
  EligibleUser,
  RecipientUser,
} from "./NotificationService.helpers";

const WORK_ORDER_RESOURCE = "workorders";
const WORK_ORDER_MOBILE_RESOURCE = "m_work_order";
const WORK_ORDER_READ_ACTION = "read";
const WORK_ORDER_DEPARTMENT_ONLY_ACTION = "department_only";
const VERIFY_ACTIONS = ["verify", "approve_request"] as const;

/**
 * POOL: user yang boleh dapat "Work Order Baru".
 * Site match + read permission; dept dibatasi lewat department_only
 * di workorders ATAU m_work_order (post-filter).
 */
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
    .filter((user: EligibleUser) =>
      isPoolDepartmentAllowed(user, input.departmentId),
    )
    .map(mapRecipientUser);
}

/**
 * STAKEHOLDERS: assignee/creator/assignments + verify/approve di site.
 * Dipakai status change, mobile action, update, assign observers.
 */
export async function findWorkOrderStakeholders(input: {
  userLookupService: UserLookupService;
  workOrderId: string;
  siteId?: string;
  departmentId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
  excludeUserId?: string;
}): Promise<RecipientUser[]> {
  const explicitIds = new Set<string>();
  for (const id of [
    input.assignedToId,
    input.createdById,
    input.requestedById,
  ]) {
    if (id) explicitIds.add(id);
  }

  try {
    const assignments = await prisma.workOrderAssignments.findMany({
      where: { workOrderId: input.workOrderId },
      select: { userId: true },
    });
    for (const row of assignments) {
      if (row.userId) explicitIds.add(row.userId);
    }
  } catch (error) {
    logger.error(
      "[Notification] Failed to load work order assignments for stakeholders:",
      error,
    );
  }

  try {
    const verifiers = await input.userLookupService.findManyWithCustomWhere({
      isActive: true,
      role: {
        permission: {
          some: {
            OR: [
              {
                resource: WORK_ORDER_RESOURCE,
                action: { in: [...VERIFY_ACTIONS] },
              },
              {
                resource: WORK_ORDER_MOBILE_RESOURCE,
                action: "verify",
              },
            ],
          },
        },
      },
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
    for (const verifier of verifiers) {
      explicitIds.add(verifier.id);
    }
  } catch (error) {
    logger.error(
      "[Notification] Failed to load WO verifiers for stakeholders:",
      error,
    );
  }

  if (input.excludeUserId) {
    explicitIds.delete(input.excludeUserId);
  }

  return [...explicitIds].map((id) => ({ id }));
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

/**
 * Pencari penerima notifikasi pengajuan upgrade paket.
 *
 * Memakai permission `pelanggan:update` — permission yang sama yang dipakai
 * route admin untuk benar-benar mengubah paket, jadi yang dinotifikasi persis
 * orang yang bisa menindaklanjutinya.
 */
export async function findPelangganManagers(input: {
  userLookupService: UserLookupService;
  siteId?: string | null;
}): Promise<RecipientUser[]> {
  return input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    role: { permission: { some: { resource: "pelanggan", action: "update" } } },
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
  // Dept matching is post-filtered (isPoolDepartmentAllowed) so multi-resource
  // department_only is accurate; Prisma where only scopes site + read.
  return {
    ...buildEligibleRecipientBaseWhere(input.excludeUserId),
    ...(siteConditions ? { OR: siteConditions } : {}),
  };
}

function buildEligibleRecipientBaseWhere(
  excludeUserId?: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    role: {
      OR: [
        {
          permission: {
            some: {
              resource: WORK_ORDER_RESOURCE,
              action: WORK_ORDER_READ_ACTION,
            },
          },
        },
        {
          permission: {
            some: {
              resource: WORK_ORDER_MOBILE_RESOURCE,
              action: WORK_ORDER_READ_ACTION,
            },
          },
        },
      ],
    },
  };
}

function buildSiteConditions(siteId: string): Prisma.UserWhereInput[] {
  return [{ siteId }, { siteId: null }, { userSites: { some: { siteId } } }];
}

function hasDepartmentOnly(user: EligibleUser): boolean {
  return (
    user.role?.permission?.some(
      (permission) =>
        permission.action === WORK_ORDER_DEPARTMENT_ONLY_ACTION &&
        (permission.resource === WORK_ORDER_RESOURCE ||
          permission.resource === WORK_ORDER_MOBILE_RESOURCE),
    ) ?? false
  );
}

function hasVerifyOrApprove(user: EligibleUser): boolean {
  return (
    user.role?.permission?.some(
      (permission) =>
        (permission.resource === WORK_ORDER_RESOURCE ||
          permission.resource === WORK_ORDER_MOBILE_RESOURCE) &&
        (permission.action === "verify" ||
          permission.action === "approve_request"),
    ) ?? false
  );
}

/** Dept gate for POOL: department_only on either resource must match WO dept. */
function isPoolDepartmentAllowed(
  user: EligibleUser,
  departmentId?: string,
): boolean {
  if (!departmentId) return true;
  if (user.departmentId === departmentId) return true;
  if (user.departmentId === null) return true;
  if (hasVerifyOrApprove(user)) return true;
  if (hasDepartmentOnly(user)) return false;
  // No department_only → broad-read at site (admin-style)
  return true;
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
