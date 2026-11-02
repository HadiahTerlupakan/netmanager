import { notifyAdminsAboutMobileAction } from "@/modules/notification";
import { WorkOrderErrors } from "../domain/errors";
import type { IWorkOrderAvailabilityRepository } from "../domain/ports/IWorkOrderAvailabilityRepository";
import { mobileAvailableWorkOrderRepository } from "../repositories/MobileAvailableWorkOrderRepository";
import {
  buildEmployeeWhereClause,
  buildMitraWhereClause,
  buildWarrantyClaimableWhere,
  canEmployeeClaimWorkOrder,
  canMitraClaimWorkOrder,
  extractUserSiteIds,
  getScheduledTimeStart,
  validateEmployeeClaimAccess,
} from "./mobile-available-work-order.helpers";
import {
  recordWorkOrderActivity,
  WORK_ORDER_ACTIVITY_ACTIONS,
} from "./work-order-activity-log";

/** Alasan penolakan klaim WO garansi yang masih milik teknisi lain. */
const WARRANTY_CLAIM_DENIED_REASON = "WO garansi milik teknisi lain";

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
      throw WorkOrderErrors.notFound(workOrderId, tenantId);
    }

    const isMitra = user.role === "MITRA";

    if (isMitra && workOrder.assignedMitraId === user.id) {
      throw WorkOrderErrors.alreadyClaimed(
        workOrderId,
        user.id,
        workOrder.scheduledDate || new Date(),
      );
    }
    if (!isMitra && workOrder.assignedToId === user.id) {
      throw WorkOrderErrors.alreadyClaimed(
        workOrderId,
        user.id,
        workOrder.scheduledDate || new Date(),
      );
    }

    if (workOrder.assignedToId || workOrder.assignedMitraId) {
      throw WorkOrderErrors.notAvailable(
        workOrderId,
        workOrder.status,
        workOrder.assignedToId,
        workOrder.assignedMitraId,
      );
    }

    if (workOrder.status !== "PENDING") {
      throw WorkOrderErrors.invalidState(
        workOrderId,
        workOrder.status,
        "Work order sudah tidak tersedia (status bukan PENDING)",
      );
    }

    const userSiteIds = extractUserSiteIds(dbUser);
    await this.validateClaimAccess({
      user,
      dbUser,
      userSiteIds,
      workOrder,
    });
    await this.ensureWarrantyClaimAllowed(workOrderId, tenantId, user.id);

    const claimTime = new Date();
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
      throw WorkOrderErrors.notAvailable(
        workOrderId,
        "CLAIMED",
        undefined,
        undefined,
      );
    }
    recordWorkOrderActivity({
      action: WORK_ORDER_ACTIVITY_ACTIONS.CLAIM,
      workOrder: { ...workOrder, tenantId },
      actorId: user.id,
      actorType: isMitra ? "mitra" : "user",
      details: { sumber: "daftar WO tersedia", pelaku: triggeredByName },
    });

    const updatedWorkOrder = await this.repository.findWorkOrderById(
      workOrderId,
      tenantId,
    );

    if (!updatedWorkOrder) {
      throw WorkOrderErrors.notFound(workOrderId, tenantId);
    }

    await this.repository.createClaimUpdate({
      workOrderId,
      userId: user.id,
      isMitra,
      triggeredByName,
      tenantId,
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

  /**
   * Apakah aktor mobile boleh membuka atau mengklaim work order yang belum
   * diambil (PENDING/REQUESTED) — aturannya sama dengan daftar WO tersedia.
   *
   * Dipakai jalur detail dan aksi CLAIM di `/api/mobile/work-orders/:id` agar
   * tidak lebih longgar daripada `claimAvailableWorkOrder`.
   */
  async canAccessUnclaimedWorkOrder(
    workOrder: { siteId: string | null; departmentId: string | null },
    user: MobileAvailableSessionUser,
  ): Promise<boolean> {
    if (user.role === "MITRA") {
      const mitra = await this.repository.findMitraProfile(user.id);
      return canMitraClaimWorkOrder({ mitraSiteId: mitra?.siteId, workOrder });
    }

    const dbUser = await this.repository.findUserProfile(
      user.id,
      user.tenantId as string,
    );
    return Boolean(
      canEmployeeClaimWorkOrder({
        dbUser,
        userSiteIds: extractUserSiteIds(dbUser),
        workOrder,
      }),
    );
  }

  /**
   * Tolak klaim WO garansi yang masih eksklusif milik teknisi lain. Aturannya
   * sama persis dengan penyaring daftar WO tersedia
   * (`buildWarrantyClaimableWhere`); dulu hanya daftar yang menerapkannya,
   * sehingga ID WO garansi orang lain tetap bisa diklaim langsung.
   */
  async ensureWarrantyClaimAllowed(
    workOrderId: string,
    tenantId: string,
    actorId: string,
  ): Promise<void> {
    const isClaimable = await this.repository.isWorkOrderMatchingFilter(
      workOrderId,
      tenantId,
      buildWarrantyClaimableWhere(actorId),
    );
    if (isClaimable) return;

    throw WorkOrderErrors.accessDenied(
      workOrderId,
      WARRANTY_CLAIM_DENIED_REASON,
      {
        userId: actorId,
      },
    );
  }

  /** Validate access before claiming a work order. */
  private async validateClaimAccess(input: {
    user: MobileAvailableSessionUser;
    dbUser: Awaited<
      ReturnType<IWorkOrderAvailabilityRepository["findUserProfile"]>
    >;
    userSiteIds: string[];
    workOrder: {
      id?: string;
      siteId: string | null;
      departmentId: string | null;
    };
  }): Promise<void> {
    if (input.user.role === "MITRA") {
      const mitra = await this.repository.findMitraProfile(input.user.id);
      const mitraSiteId = mitra?.siteId;

      if (
        !canMitraClaimWorkOrder({ mitraSiteId, workOrder: input.workOrder })
      ) {
        throw WorkOrderErrors.accessDenied(
          input.workOrder.id || "unknown",
          "Beda Site",
          {
            workOrderSiteId: input.workOrder.siteId,
            mitraSiteId,
            userId: input.user.id,
          },
        );
      }

      return;
    }

    const accessError = validateEmployeeClaimAccess({
      dbUser: input.dbUser,
      userSiteIds: input.userSiteIds,
      workOrder: input.workOrder,
    });

    if (accessError) {
      throw WorkOrderErrors.accessDenied(
        input.workOrder.id || "unknown",
        "Beda Department/Site",
        {
          workOrderSiteId: input.workOrder.siteId,
          workOrderDepartmentId: input.workOrder.departmentId,
          userSiteIds: input.userSiteIds,
          userDepartmentId: input.dbUser?.departmentId,
          userId: input.user.id,
        },
      );
    }
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
