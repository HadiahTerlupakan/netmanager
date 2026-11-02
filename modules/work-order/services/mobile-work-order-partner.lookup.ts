import { randomUUID } from "crypto";

import { prisma } from "@/modules/database";

const PARTNER_ROLE = "PARTNER";
const PENDING_ASSIGNMENT_STATUS = "PENDING";

export function createPartnerAssignment(input: {
  workOrderId: string;
  actorId: string;
  tenantId: string;
  partnerUserId: string;
}) {
  return prisma.workOrderAssignments.create({
    data: {
      id: randomUUID(),
      workOrderId: input.workOrderId,
      userId: input.partnerUserId,
      role: PARTNER_ROLE,
      status: PENDING_ASSIGNMENT_STATUS,
      assignedAt: new Date(),
      assignedById: input.actorId,
      tenantId: input.tenantId,
    },
    include: getAssignmentUserInclude(),
  });
}

export function updatePartnerInvitationResponse(input: {
  assignmentId: string;
  tenantId: string;
  response: "PENDING" | "APPROVED" | "REJECTED";
}) {
  return prisma.workOrderAssignments.update({
    where: { id: input.assignmentId, tenantId: input.tenantId },
    data: { status: input.response, respondedAt: new Date() },
    include: getAssignmentUserInclude(),
  });
}

export function findWorkOrder(workOrderId: string, tenantId: string) {
  return prisma.workOrders.findFirst({
    where: { id: workOrderId, tenantId },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      tenantId: true,
      status: true,
      createdById: true,
      assignedToId: true,
      siteId: true,
      departmentId: true,
    },
  });
}

export function findTargetUser(userId: string, tenantId: string) {
  return prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true, name: true, email: true },
  });
}

export function findPartnerAssignment(
  workOrderId: string,
  userId: string,
  tenantId: string,
) {
  return prisma.workOrderAssignments.findFirst({
    where: { workOrderId, userId, role: PARTNER_ROLE, tenantId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}

export function findAssignmentForRemoval(
  assignmentId: string,
  tenantId: string,
) {
  return prisma.workOrderAssignments.findFirst({
    where: { id: assignmentId, tenantId },
    include: {
      workOrders: {
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          tenantId: true,
          createdById: true,
          assignedToId: true,
          siteId: true,
          departmentId: true,
        },
      },
    },
  });
}

/** Toggle lingkup work order yang relevan bagi admin pengelola partner. */
const WORK_ORDER_SCOPE_ACTIONS = ["site_only", "department_only"] as const;

/**
 * Profil admin untuk pengelolaan partner: apakah role-nya admin panel, plus
 * site/departemen dan toggle `workorders:*_only` agar lingkupnya bisa dinilai.
 */
export async function findPartnerAdminProfile(
  userId: string,
  tenantId: string,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      siteId: true,
      departmentId: true,
      role: {
        select: {
          accessAdminPanel: true,
          isSuperAdmin: true,
          permission: {
            where: {
              resource: "workorders",
              action: { in: [...WORK_ORDER_SCOPE_ACTIONS] },
            },
            select: { resource: true, action: true },
          },
        },
      },
    },
  });

  return {
    isAdmin: Boolean(user?.role?.accessAdminPanel || user?.role?.isSuperAdmin),
    isSuperAdmin: Boolean(user?.role?.isSuperAdmin),
    siteId: user?.siteId ?? undefined,
    departmentId: user?.departmentId ?? undefined,
    permissions: (user?.role?.permission ?? []).map(
      (permission) => `${permission.resource}:${permission.action}`,
    ),
  };
}

function getAssignmentUserInclude() {
  return {
    user: {
      select: { id: true, name: true, email: true, image: true },
    },
  };
}
