import { prisma } from "@/modules/database";

import {
  canInvitePartnerToday,
  PARTNER_ON_LEAVE_ERROR_MESSAGE,
} from "./partner-invite-availability";
import {
  createPartnerAssignment,
  findAssignmentForRemoval,
  findPartnerAssignment,
  findTargetUser,
  findWorkOrder,
  hasPartnerAdminAccess,
  updatePartnerInvitationResponse,
} from "./mobile-work-order-partner.lookup";

type PartnerAssignmentStatus = "PENDING" | "APPROVED" | "REJECTED";

const PENDING_ASSIGNMENT_STATUS: PartnerAssignmentStatus = "PENDING";
const DUPLICATE_PARTNER_ASSIGNMENT_ERROR_MESSAGE =
  "User sudah ditambahkan sebagai partner di work order ini";

interface ManagePartnerAccessInput {
  assignedById?: string | null;
  createdById?: string | null;
  assignedToId?: string | null;
  actorId: string;
  isAdmin: boolean;
}

interface AddPartnerInput {
  workOrderId: string;
  actorId: string;
  tenantId: string;
  partnerUserId: string;
}

interface RemovePartnerInput {
  assignmentId: string;
  workOrderId: string;
  actorId: string;
  tenantId: string;
}

interface RespondPartnerInvitationInput {
  workOrderId: string;
  actorId: string;
  tenantId: string;
  response: PartnerAssignmentStatus;
}

export class MobileWorkOrderPartnerService {
  async addPartner(input: AddPartnerInput) {
    const workOrder = await findWorkOrder(input.workOrderId, input.tenantId);
    if (!workOrder) {
      throw new Error("WORK_ORDER_NOT_FOUND");
    }

    const targetUser = await findTargetUser(
      input.partnerUserId,
      input.tenantId,
    );
    if (!targetUser) {
      throw new Error("USER_NOT_FOUND");
    }

    await this.ensurePartnerAccess({
      actorId: input.actorId,
      createdById: workOrder.createdById,
      assignedToId: workOrder.assignedToId,
      tenantId: input.tenantId,
    });
    await this.ensurePartnerAssignmentAvailable(
      input.workOrderId,
      input.partnerUserId,
      input.tenantId,
    );
    await this.ensurePartnerAvailableToday(input.partnerUserId, input.tenantId);

    return createPartnerAssignment(input);
  }

  async removePartner(input: RemovePartnerInput) {
    const assignment = await findAssignmentForRemoval(
      input.assignmentId,
      input.tenantId,
    );
    if (!assignment) {
      throw new Error("ASSIGNMENT_NOT_FOUND");
    }
    if (assignment.workOrderId !== input.workOrderId) {
      throw new Error("ASSIGNMENT_WORK_ORDER_MISMATCH");
    }

    await this.ensurePartnerAccess({
      actorId: input.actorId,
      assignedById: assignment.assignedById,
      createdById: assignment.workOrders.createdById,
      assignedToId: assignment.workOrders.assignedToId,
      tenantId: input.tenantId,
    });

    await prisma.workOrderAssignments.delete({
      where: { id: input.assignmentId, tenantId: input.tenantId },
    });
  }

  async respondToInvitation(input: RespondPartnerInvitationInput) {
    const workOrder = await findWorkOrder(input.workOrderId, input.tenantId);
    if (!workOrder) {
      throw new Error("WORK_ORDER_NOT_FOUND");
    }

    const assignment = await findPartnerAssignment(
      input.workOrderId,
      input.actorId,
      input.tenantId,
    );
    if (!assignment) {
      throw new Error("PARTNER_ASSIGNMENT_NOT_FOUND");
    }

    if (assignment.status !== PENDING_ASSIGNMENT_STATUS) {
      return {
        isAlreadyResponded: true as const,
        currentStatus: assignment.status,
      };
    }

    const updatedAssignment = await updatePartnerInvitationResponse({
      assignmentId: assignment.id,
      tenantId: input.tenantId,
      response: input.response,
    });

    return {
      isAlreadyResponded: false as const,
      currentStatus: updatedAssignment.status,
      assignment: updatedAssignment,
      workOrder,
    };
  }

  getDuplicateAssignmentErrorMessage() {
    return DUPLICATE_PARTNER_ASSIGNMENT_ERROR_MESSAGE;
  }

  getPartnerOnLeaveErrorMessage() {
    return PARTNER_ON_LEAVE_ERROR_MESSAGE;
  }

  isDuplicateAssignmentError(error: unknown) {
    return this.getErrorCode(error) === "P2002";
  }

  private async ensurePartnerAccess(input: {
    actorId: string;
    createdById?: string | null;
    assignedToId?: string | null;
    assignedById?: string | null;
    tenantId: string;
  }) {
    const isAdmin = await hasPartnerAdminAccess(input.actorId, input.tenantId);
    const canManage = this.canManageWorkOrderPartner({
      actorId: input.actorId,
      assignedById: input.assignedById,
      createdById: input.createdById,
      assignedToId: input.assignedToId,
      isAdmin,
    });

    if (!canManage) {
      throw new Error("FORBIDDEN");
    }
  }

  private async ensurePartnerAssignmentAvailable(
    workOrderId: string,
    partnerUserId: string,
    tenantId: string,
  ) {
    const existingAssignment = await prisma.workOrderAssignments.findFirst({
      where: {
        workOrderId,
        userId: partnerUserId,
        role: "PARTNER",
        tenantId,
      },
    });

    if (existingAssignment) {
      throw new Error("DUPLICATE_ASSIGNMENT");
    }
  }

  private async ensurePartnerAvailableToday(userId: string, tenantId: string) {
    const isPartnerAvailableToday = await canInvitePartnerToday(
      userId,
      tenantId,
    );
    if (!isPartnerAvailableToday) {
      throw new Error("PARTNER_ON_LEAVE");
    }
  }

  private canManageWorkOrderPartner(input: ManagePartnerAccessInput) {
    return (
      input.assignedById === input.actorId ||
      input.createdById === input.actorId ||
      input.assignedToId === input.actorId ||
      input.isAdmin
    );
  }

  private getErrorCode(error: unknown) {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return undefined;
    }

    return String(error.code);
  }
}
