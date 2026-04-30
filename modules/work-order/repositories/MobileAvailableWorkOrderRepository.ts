import { prisma, prismaMitra } from "@/modules/database";
import { Prisma, WorkOrderStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import type { IWorkOrderAvailabilityRepository } from "../domain/ports/IWorkOrderAvailabilityRepository";
import type {
  ClaimAvailableWorkOrderData,
  CreateClaimUpdateData,
} from "../domain/ports/IWorkOrderAvailabilityRepository";
import { WorkOrderAvailabilityMapper } from "../mappers/WorkOrderAvailabilityMapper";
import {
  AVAILABLE_WORK_ORDER_STATUS,
  CLAIMED_WORK_ORDER_STATUS,
  MOBILE_AVAILABLE_WORK_ORDER_LIMIT,
  MOBILE_CLAIM_ROLE,
} from "../validators/workOrderValidators";

export class MobileAvailableWorkOrderRepository implements IWorkOrderAvailabilityRepository {
  /** Get employee profile needed for mobile WO availability rules. */
  async findUserProfile(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        departmentId: true,
        siteId: true,
        name: true,
        userSites: { select: { siteId: true } },
      },
    });

    return user ? WorkOrderAvailabilityMapper.toUserProfileDomain(user) : null;
  }

  /** Get mitra profile needed for mobile WO availability rules. */
  async findMitraProfile(userId: string) {
    const mitra = await prismaMitra.mitra.findUnique({
      where: { id: userId },
      select: { name: true, siteId: true },
    });

    return mitra
      ? WorkOrderAvailabilityMapper.toMitraProfileDomain(mitra)
      : null;
  }

  /** Get available work orders for mobile claim flow. */
  async findAvailableWorkOrders(where: Prisma.WorkOrdersWhereInput) {
    const workOrders = await prisma.workOrders.findMany({
      where,
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        description: true,
        type: true,
        status: true,
        priority: true,
        contactName: true,
        contactPhone: true,
        locationAddress: true,
        scheduledDate: true,
        createdAt: true,
        tenantId: true,
        siteId: true,
        departmentId: true,
        assignedToId: true,
        assignedMitraId: true,
        pelanggan: {
          select: { id: true, nama: true, alamat: true, noTelp: true },
        },
        site: { select: { id: true, name: true, address: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: [
        { priority: "desc" },
        { scheduledDate: "asc" },
        { createdAt: "desc" },
      ],
      take: MOBILE_AVAILABLE_WORK_ORDER_LIMIT,
    });

    return workOrders.map((workOrder) =>
      WorkOrderAvailabilityMapper.toDomain(workOrder),
    );
  }

  /** Find a work order by id in the active tenant. */
  async findWorkOrderById(workOrderId: string, tenantId: string) {
    const workOrder = await prisma.workOrders.findFirst({
      where: { id: workOrderId, tenantId },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        description: true,
        type: true,
        status: true,
        priority: true,
        contactName: true,
        contactPhone: true,
        locationAddress: true,
        scheduledDate: true,
        createdAt: true,
        tenantId: true,
        siteId: true,
        departmentId: true,
        assignedToId: true,
        assignedMitraId: true,
        pelanggan: {
          select: { id: true, nama: true, alamat: true, noTelp: true },
        },
        site: { select: { id: true, name: true, address: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return workOrder ? WorkOrderAvailabilityMapper.toDomain(workOrder) : null;
  }

  /** Claim a pending work order atomically for one actor. */
  async claimWorkOrder(input: ClaimAvailableWorkOrderData) {
    const result = await prisma.workOrders.updateMany({
      where: {
        id: input.workOrderId,
        tenantId: input.tenantId,
        status: AVAILABLE_WORK_ORDER_STATUS as WorkOrderStatus,
        assignedToId: null,
        assignedMitraId: null,
      },
      data: {
        ...(input.isMitra
          ? { assignedMitraId: input.userId }
          : { assignedToId: input.userId }),
        status: CLAIMED_WORK_ORDER_STATUS,
        scheduledDate: input.claimedAt,
        scheduledTimeStart: input.scheduledTimeStart,
      },
    });

    return result.count > 0;
  }

  /** Create an assignment row if it does not already exist. */
  async createAssignment(
    workOrderId: string,
    userId: string,
    isMitra: boolean,
  ) {
    try {
      await prisma.workOrderAssignments.create({
        data: isMitra
          ? {
              id: randomUUID(),
              workOrderId,
              mitraId: userId,
              role: MOBILE_CLAIM_ROLE,
              status: "PENDING",
            }
          : {
              id: randomUUID(),
              workOrderId,
              userId,
              role: MOBILE_CLAIM_ROLE,
              status: "PENDING",
            },
      });
    } catch (error) {
      if (!this.isDuplicateAssignmentError(error)) {
        throw error;
      }
    }
  }

  /** Append timeline update after a successful claim. */
  async createClaimUpdate(params: CreateClaimUpdateData) {
    await prisma.workOrderUpdates.create({
      data: {
        id: randomUUID(),
        workOrderId: params.workOrderId,
        createdById: params.isMitra ? null : params.userId,
        updateType: "STATUS_CHANGE",
        message: params.isMitra
          ? `Tiket diambil via Mobile App oleh Mitra Teknisi (${params.triggeredByName})`
          : "Tiket diambil via Mobile App",
        oldStatus: "PENDING",
        newStatus: "ASSIGNED",
      },
    });
  }

  /** Check whether the database error is a duplicate assignment violation. */
  private isDuplicateAssignmentError(error: unknown) {
    return !!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}

export const mobileAvailableWorkOrderRepository =
  new MobileAvailableWorkOrderRepository();
