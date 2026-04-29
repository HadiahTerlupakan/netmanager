import type { LeaveStatus, Prisma } from "@prisma/client";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { LeaveLookupRepository } from "./LeaveLookupRepository";
import { LeaveMobileRepository } from "./LeaveMobileRepository";
import { LeaveRequestRepository } from "./LeaveRequestRepository";

export class LeaveRepository implements ILeaveRepository {
  private readonly lookup = new LeaveLookupRepository();
  private readonly mobile = new LeaveMobileRepository();
  private readonly request = new LeaveRequestRepository();

  /** Get leave requester context for mobile submission. */
  findRequesterContext(userId: string, tenantId: string) {
    return this.mobile.findRequesterContext(userId, tenantId);
  }

  /** Get approver admin IDs for leave notification. */
  findApproverIdsForMobileLeaveNotification(input: {
    tenantId: string;
    siteId?: string | null;
  }) {
    return this.mobile.findApproverIdsForMobileLeaveNotification(input);
  }

  /** Create leave request with generated id. */
  create(
    data: Omit<Prisma.LeaveRequestUncheckedCreateInput, "id" | "updatedAt">,
  ) {
    return this.request.create(data);
  }

  /** Update leave request by id. */
  update(id: string, data: Prisma.LeaveRequestUpdateInput) {
    return this.request.update(id, data);
  }

  /** Delete leave request by id. */
  delete(id: string) {
    return this.request.delete(id);
  }

  /** Find leave request with compact user metadata. */
  findById(id: string) {
    return this.request.findById(id);
  }

  /** Find leave requests with admin filters. */
  findAll(filters?: {
    userId?: string;
    status?: LeaveStatus;
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    siteId?: string;
    skip?: number;
    take?: number;
    tenantId?: string;
  }) {
    return this.request.findAll(filters);
  }

  /** Count leave requests with admin filters. */
  count(filters?: {
    userId?: string;
    status?: LeaveStatus;
    departmentId?: string;
    siteId?: string;
    tenantId?: string;
  }) {
    return this.request.count(filters);
  }

  /** Get approved leave stats grouped by user. */
  getUserLeaveStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.lookup.getUserLeaveStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Find active approved leave for a user on date range. */
  findActiveLeaveForUserOnDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ) {
    return this.lookup.findActiveLeaveForUserOnDate(
      userId,
      startOfDay,
      endOfDay,
      tenantId,
    );
  }

  /** Find approved Tukar Libur for source/replacement date. */
  findApprovedTukarLiburForUserOnDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ) {
    return this.lookup.findApprovedTukarLiburForUserOnDate(
      userId,
      startOfDay,
      endOfDay,
      tenantId,
    );
  }

  /** Find approved leave for auto-alpha date range. */
  findApprovedLeaveForUserOnDateRange(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    return this.lookup.findApprovedLeaveForUserOnDateRange(
      userId,
      tenantId,
      startOfDay,
      endOfDay,
    );
  }

  /** Find leave by ID with user relation included. */
  findByIdWithUser(id: string, tenantId: string) {
    return this.lookup.findByIdWithUser(id, tenantId);
  }

  /** Find approved leaves in a date range with user relation included. */
  findApprovedInRangeWithUser(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ) {
    return this.lookup.findApprovedInRangeWithUser(
      startDate,
      endDate,
      tenantId,
      userId,
    );
  }
}
