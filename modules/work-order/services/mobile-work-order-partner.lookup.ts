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
      status: true,
      createdById: true,
      assignedToId: true,
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
        select: { id: true, createdById: true, assignedToId: true },
      },
    },
  });
}

export async function hasPartnerAdminAccess(userId: string, tenantId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      role: {
        select: { accessAdminPanel: true, isSuperAdmin: true },
      },
    },
  });

  return Boolean(user?.role?.accessAdminPanel || user?.role?.isSuperAdmin);
}

function getAssignmentUserInclude() {
  return {
    user: {
      select: { id: true, name: true, email: true, image: true },
    },
  };
}
