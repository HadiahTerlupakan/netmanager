import { ApiErrors, apiError, ErrorCodes } from "@/lib/api";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";
import type { IWorkOrderAvailabilityRepository } from "../domain/ports/IWorkOrderAvailabilityRepository";
import { mobileAvailableWorkOrderRepository } from "../repositories/MobileAvailableWorkOrderRepository";
import {
  buildEmployeeWhereClause,
  buildMitraWhereClause,
  extractUserSiteIds,
  getScheduledTimeStart,
  validateClaimState,
  validateEmployeeClaimAccess,
} from "./mobile-available-work-order.helpers";

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
      const where = buildMitraWhereClause(tenantId, userId, mitra?.siteId);
      return this.repository.findAvailableWorkOrders(where);
    }

    const dbUser = await this.repository.findUserProfile(userId, tenantId);
    const userSiteIds = extractUserSiteIds(dbUser);
    const where = buildEmployeeWhereClause(
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

    const invalidStateError = validateClaimState(workOrder);
    if (invalidStateError) {
      return invalidStateError;
    }

    const userSiteIds = extractUserSiteIds(dbUser);
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
    const scheduledTimeStart = getScheduledTimeStart(claimTime);

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

  /** Validate access before claiming a work order. */
  private async validateClaimAccess(input: {
    user: MobileAvailableSessionUser;
    dbUser: Awaited<
      ReturnType<IWorkOrderAvailabilityRepository["findUserProfile"]>
    >;
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

    return validateEmployeeClaimAccess({
      dbUser: input.dbUser,
      userSiteIds: input.userSiteIds,
      workOrder: input.workOrder,
    });
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
}

let mobileAvailableWorkOrderServiceInstance: MobileAvailableWorkOrderService | null =
  null;

/** Return the shared mobile available work-order service lazily. */
export function getMobileAvailableWorkOrderService() {
  mobileAvailableWorkOrderServiceInstance ??=
    new MobileAvailableWorkOrderService();
  return mobileAvailableWorkOrderServiceInstance;
}
