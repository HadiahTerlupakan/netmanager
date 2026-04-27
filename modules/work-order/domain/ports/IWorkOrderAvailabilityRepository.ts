import type { Prisma } from "@prisma/client";
import type {
  AvailableWorkOrderEntity,
  MobileAvailableMitraProfileEntity,
  MobileAvailableUserProfileEntity,
} from "../entities/WorkOrderEntity";

export interface ClaimAvailableWorkOrderData {
  workOrderId: string;
  tenantId: string;
  userId: string;
  isMitra: boolean;
  claimedAt: Date;
  scheduledTimeStart: string;
}

export interface CreateClaimUpdateData {
  workOrderId: string;
  userId: string;
  isMitra: boolean;
  triggeredByName: string;
}

export interface IWorkOrderAvailabilityRepository {
  /** Get employee profile needed for availability rules. */
  findUserProfile(
    userId: string,
    tenantId: string,
  ): Promise<MobileAvailableUserProfileEntity | null>;

  /** Get mitra profile needed for availability rules. */
  findMitraProfile(
    userId: string,
  ): Promise<MobileAvailableMitraProfileEntity | null>;

  /** Get work orders that match the given availability filter. */
  findAvailableWorkOrders(
    where: Prisma.WorkOrdersWhereInput,
  ): Promise<AvailableWorkOrderEntity[]>;

  /** Find one work order in current tenant. */
  findWorkOrderById(
    workOrderId: string,
    tenantId: string,
  ): Promise<AvailableWorkOrderEntity | null>;

  /** Claim a work order atomically. */
  claimWorkOrder(input: ClaimAvailableWorkOrderData): Promise<boolean>;

  /** Create assignment row for a claim. */
  createAssignment(
    workOrderId: string,
    userId: string,
    isMitra: boolean,
  ): Promise<void>;

  /** Append claim update to timeline. */
  createClaimUpdate(data: CreateClaimUpdateData): Promise<void>;
}
