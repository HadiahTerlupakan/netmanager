import { ApiErrors, apiError, ErrorCodes } from "@/lib/api";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";
/**
 * NOTE: Prisma import is intentionally kept here for type safety.
 * This service uses Prisma.WorkOrdersWhereInput for dynamic query building.
 * Removing this would require duplicating all Prisma types or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import { Prisma } from "@prisma/client";
import type { MobileAvailableUserProfileEntity } from "../domain/entities/WorkOrderEntity";
import type { IWorkOrderAvailabilityRepository } from "../domain/ports/IWorkOrderAvailabilityRepository";
import { mobileAvailableWorkOrderRepository } from "../repositories/MobileAvailableWorkOrderRepository";
import { AVAILABLE_WORK_ORDER_STATUS } from "../validators/workOrderValidators";

export interface MobileAvailableSessionUser {
  id: string;
  role?: string;
  name?: string | null;
  tenantId?: string | null;
}

export class MobileAvailableWorkOrderService {
  private repository: IWorkOrderAvailabilityRepository;

  constructor(
    repository: IWorkOrderAvailabilityRepository = mobileAvailableWorkOrderRepository,
  ) {
    this.repository = repository;
  }

  /** List work orders that can be claimed by the current mobile actor. */
  async getAvailableWorkOrders(user: MobileAvailableSessionUser) {
    const tenantId = user.tenantId as string;
    const userId = user.id;

    if (user.role === "MITRA") {
      const mitra = await this.repository.findMitraProfile(userId);
      const where = this.buildMitraWhereClause(tenantId, userId, mitra?.siteId);
      return this.repository.findAvailableWorkOrders(where);
    }

    const dbUser = await this.repository.findUserProfile(userId, tenantId);
    const userSiteIds = this.extractUserSiteIds(dbUser);
    const where = this.buildEmployeeWhereClause(
      tenantId,
      userId,
      dbUser,
      userSiteIds,
    );

    return this.repository.findAvailableWorkOrders(where);
  }

  /** Claim an available work order for the current mobile actor. */
  async claimAvailableWorkOrder(
    workOrderId: string,
    user: MobileAvailableSessionUser,
  ) {
    const tenantId = user.tenantId as string;
    const dbUser = await this.repository.findUserProfile(user.id, tenantId);
    const workOrder = await this.repository.findWorkOrderById(
      workOrderId,
      tenantId,
    );

    if (!workOrder) {
      return ApiErrors.notFound("Work order tidak ditemukan");
    }

    const invalidStateError = this.validateClaimState(workOrder);
    if (invalidStateError) {
      return invalidStateError;
    }

    const userSiteIds = this.extractUserSiteIds(dbUser);
    const accessError = await this.validateClaimAccess({
      user,
      dbUser,
      userSiteIds,
      workOrder,
    });
    if (accessError) {
      return accessError;
    }

    const claimTime = new Date();
    const isMitra = user.role === "MITRA";
    const triggeredByName = await this.resolveTriggeredByName(
      user,
      dbUser?.name,
    );
    const scheduledTimeStart = this.getScheduledTimeStart(claimTime);

    const hasClaimed = await this.repository.claimWorkOrder({
      workOrderId,
      tenantId,
      userId: user.id,
      isMitra,
      claimedAt: claimTime,
      scheduledTimeStart,
    });

    if (!hasClaimed) {
      return apiError(
        "Work order sudah tidak tersedia",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const updatedWorkOrder = await this.repository.findWorkOrderById(
      workOrderId,
      tenantId,
    );

    if (!updatedWorkOrder) {
      return ApiErrors.notFound("Work order tidak ditemukan");
    }

    await this.repository.createAssignment(workOrderId, user.id, isMitra);
    await this.repository.createClaimUpdate({
      workOrderId,
      userId: user.id,
      isMitra,
      triggeredByName,
    });

    await notifyAdminsAboutMobileAction({
      workOrderId,
      workOrderNumber: updatedWorkOrder.workOrderNumber,
      title: updatedWorkOrder.title,
      actionType: "CLAIM",
      actionMessage: "Mengambil/Claim tiket Work Order",
      triggeredByUserId: user.id,
      triggeredByName,
      ...(updatedWorkOrder.departmentId && {
        departmentId: updatedWorkOrder.departmentId,
      }),
      ...(updatedWorkOrder.siteId && { siteId: updatedWorkOrder.siteId }),
    });

    return { workOrder: updatedWorkOrder };
  }

  /** Build employee-specific availability filter. */
  private buildEmployeeWhereClause(
    tenantId: string,
    userId: string,
    dbUser: MobileAvailableUserProfileEntity | null,
    userSiteIds: string[],
  ): Prisma.WorkOrdersWhereInput {
    return {
      ...this.getBaseAvailableWhere(tenantId, userId),
      AND: [
        dbUser?.departmentId
          ? {
              OR: [
                { departmentId: null },
                { departmentId: dbUser.departmentId },
              ],
            }
          : { departmentId: null },
        userSiteIds.length > 0
          ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
          : { siteId: null },
      ],
    };
  }

  /** Build mitra-specific availability filter. */
  private buildMitraWhereClause(
    tenantId: string,
    userId: string,
    mitraSiteId: string | null | undefined,
  ): Prisma.WorkOrdersWhereInput {
    return {
      ...this.getBaseAvailableWhere(tenantId, userId),
      AND: [
        mitraSiteId
          ? { OR: [{ siteId: null }, { siteId: mitraSiteId }] }
          : { siteId: null },
      ],
    };
  }

  /** Build the shared base filter for available work orders. */
  private getBaseAvailableWhere(
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
          OR: [
            { warrantySla: { lt: new Date() } },
            { warrantyOwnerId: userId },
          ],
        },
      ],
    };
  }

  /** Extract effective site ids for a regular employee. */
  private extractUserSiteIds(dbUser: MobileAvailableUserProfileEntity | null) {
    if (dbUser?.userSites?.length) {
      return dbUser.userSites.map((userSite) => userSite.siteId);
    }

    return dbUser?.siteId ? [dbUser.siteId] : [];
  }

  /** Validate whether the current work order can still be claimed. */
  private validateClaimState(workOrder: {
    status: string;
    assignedToId: string | null;
    assignedMitraId: string | null;
  }) {
    if (workOrder.status !== AVAILABLE_WORK_ORDER_STATUS) {
      return apiError(
        "Work order sudah tidak tersedia",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (workOrder.assignedToId || workOrder.assignedMitraId) {
      return apiError(
        "Work order sudah diambil orang lain",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return null;
  }

  /** Validate access before claiming a work order. */
  private async validateClaimAccess(input: {
    user: MobileAvailableSessionUser;
    dbUser: MobileAvailableUserProfileEntity | null;
    userSiteIds: string[];
    workOrder: {
      siteId: string | null;
      departmentId: string | null;
    };
  }) {
    if (input.user.role === "MITRA") {
      const mitra = await this.repository.findMitraProfile(input.user.id);
      const mitraSiteId = mitra?.siteId;

      if (input.workOrder.siteId && mitraSiteId !== input.workOrder.siteId) {
        return apiError(
          "Anda tidak memiliki akses ke Work Order ini (Beda Site)",
          ErrorCodes.FORBIDDEN,
          { status: 403 },
        );
      }

      return null;
    }

    const isDeptValid =
      !input.workOrder.departmentId ||
      (input.dbUser?.departmentId &&
        input.workOrder.departmentId === input.dbUser.departmentId);
    const isSiteValid =
      !input.workOrder.siteId ||
      input.userSiteIds.includes(input.workOrder.siteId);

    if (isDeptValid && isSiteValid) {
      return null;
    }

    return ApiErrors.forbidden(
      "Anda tidak memiliki akses ke Work Order ini (Beda Department/Site)",
    );
  }

  /** Resolve actor display name for timeline and notifications. */
  private async resolveTriggeredByName(
    user: MobileAvailableSessionUser,
    defaultName?: string | null,
  ) {
    if (user.role !== "MITRA") {
      return defaultName || user.name || "Unknown";
    }

    const mitra = await this.repository.findMitraProfile(user.id);
    return mitra?.name || user.name || "Unknown Mitra";
  }

  /** Format claim time as HH:mm in local Indonesian locale. */
  private getScheduledTimeStart(date: Date) {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
}

let mobileAvailableWorkOrderServiceInstance: MobileAvailableWorkOrderService | null =
  null;

/** Return the shared mobile available work-order service lazily. */
export function getMobileAvailableWorkOrderService() {
  mobileAvailableWorkOrderServiceInstance ??=
    new MobileAvailableWorkOrderService();
  return mobileAvailableWorkOrderServiceInstance;
}
