import { ApiErrors, apiError, ErrorCodes } from "@/lib/api";
import { Prisma } from "@prisma/client";

import type { MobileAvailableUserProfileEntity } from "../domain/entities/WorkOrderEntity";
import { AVAILABLE_WORK_ORDER_STATUS } from "../validators/workOrderValidators";

export function buildEmployeeWhereClause(
  tenantId: string,
  userId: string,
  dbUser: MobileAvailableUserProfileEntity | null,
  userSiteIds: string[],
): Prisma.WorkOrdersWhereInput {
  return {
    ...getBaseAvailableWhere(tenantId, userId),
    AND: [
      dbUser?.departmentId
        ? {
            OR: [{ departmentId: null }, { departmentId: dbUser.departmentId }],
          }
        : { departmentId: null },
      userSiteIds.length > 0
        ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
        : { siteId: null },
    ],
  };
}

export function buildMitraWhereClause(
  tenantId: string,
  userId: string,
  mitraSiteId: string | null | undefined,
): Prisma.WorkOrdersWhereInput {
  return {
    ...getBaseAvailableWhere(tenantId, userId),
    AND: [
      mitraSiteId
        ? { OR: [{ siteId: null }, { siteId: mitraSiteId }] }
        : { siteId: null },
    ],
  };
}

export function extractUserSiteIds(
  dbUser: MobileAvailableUserProfileEntity | null,
) {
  if (dbUser?.userSites?.length) {
    return dbUser.userSites.map((userSite) => userSite.siteId);
  }

  return dbUser?.siteId ? [dbUser.siteId] : [];
}

export function validateClaimState(workOrder: {
  status: string;
  assignedToId: string | null;
  assignedMitraId: string | null;
}) {
  if (workOrder.status !== AVAILABLE_WORK_ORDER_STATUS) {
    return buildClaimValidationError("Work order sudah tidak tersedia");
  }

  if (hasAssignedClaimOwner(workOrder)) {
    return buildClaimValidationError("Work order sudah diambil orang lain");
  }

  return null;
}

export function validateEmployeeClaimAccess(input: {
  dbUser: MobileAvailableUserProfileEntity | null;
  userSiteIds: string[];
  workOrder: {
    siteId: string | null;
    departmentId: string | null;
  };
}) {
  if (canEmployeeClaimWorkOrder(input)) {
    return null;
  }

  return ApiErrors.forbidden(
    "Anda tidak memiliki akses ke Work Order ini (Beda Department/Site)",
  );
}

function buildClaimValidationError(message: string) {
  return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
}

function hasAssignedClaimOwner(workOrder: {
  assignedToId: string | null;
  assignedMitraId: string | null;
}) {
  return Boolean(workOrder.assignedToId || workOrder.assignedMitraId);
}

function canEmployeeClaimWorkOrder(input: {
  dbUser: MobileAvailableUserProfileEntity | null;
  userSiteIds: string[];
  workOrder: {
    siteId: string | null;
    departmentId: string | null;
  };
}) {
  return hasDepartmentAccess(input) && hasSiteAccess(input);
}

function hasDepartmentAccess(input: {
  dbUser: MobileAvailableUserProfileEntity | null;
  workOrder: { departmentId: string | null };
}) {
  return (
    !input.workOrder.departmentId ||
    (input.dbUser?.departmentId &&
      input.workOrder.departmentId === input.dbUser.departmentId)
  );
}

function hasSiteAccess(input: {
  userSiteIds: string[];
  workOrder: { siteId: string | null };
}) {
  return (
    !input.workOrder.siteId ||
    input.userSiteIds.includes(input.workOrder.siteId)
  );
}

export function getScheduledTimeStart(date: Date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getBaseAvailableWhere(
  tenantId: string,
  userId: string,
): Prisma.WorkOrdersWhereInput {
  return {
    status: AVAILABLE_WORK_ORDER_STATUS as never,
    assignedToId: null as string | null,
    assignedMitraId: null as string | null,
    tenantId,
    OR: [
      { isWarranty: false },
      {
        isWarranty: true,
        OR: [{ warrantySla: { lt: new Date() } }, { warrantyOwnerId: userId }],
      },
    ],
  };
}
