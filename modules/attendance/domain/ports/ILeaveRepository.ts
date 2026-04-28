import type {
  ActiveLeaveEntity,
  LeaveApproverEntity,
  LeaveRequesterContextEntity,
  TukarLiburDateEntity,
} from "../entities/LeaveEntity";

export type LeaveStatusValue =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | string;
export type LeaveCreateInput = Record<string, unknown>;
export type LeaveUpdateInput = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeaveRequestRecord = any;

export type LeaveListItemEntity = LeaveRequestRecord & {
  user: {
    name: string | null;
    image?: string | null;
    departments: { name: string | null } | null;
    sites: { name: string | null } | null;
  } | null;
};

export type LeaveWithUserEntity = LeaveRequestRecord & {
  user: {
    id: string;
    name: string | null;
    workingHourMode: string | null;
    workDays: string | null;
    tenantId: string | null;
    joinDate: Date | null;
    siteId: string | null;
    departmentId: string | null;
  };
};

export type LeaveFiltersEntity = {
  userId?: string;
  status?: LeaveStatusValue;
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  siteId?: string;
  skip?: number;
  take?: number;
  tenantId?: string;
};

export interface ILeaveRepository {
  /** Create a leave request record. */
  create(data: LeaveCreateInput): Promise<LeaveRequestRecord>;

  /** List leave requests using the provided filters. */
  findAll(filters?: LeaveFiltersEntity): Promise<LeaveListItemEntity[]>;

  /** Count leave requests using the provided filters. */
  count(
    filters?: Omit<
      LeaveFiltersEntity,
      "startDate" | "endDate" | "skip" | "take"
    >,
  ): Promise<number>;

  /** Find leave with user relation for approval flow. */
  findByIdWithUser(
    id: string,
    tenantId: string,
  ): Promise<LeaveWithUserEntity | null>;

  /** Find approved leaves within range for sync operation. */
  findApprovedInRangeWithUser(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ): Promise<LeaveWithUserEntity[]>;

  /** Update a leave request record. */
  update(id: string, data: LeaveUpdateInput): Promise<LeaveRequestRecord>;

  /** Delete a leave request record. */
  delete(id: string): Promise<LeaveRequestRecord>;

  /** Load requester schedule context for leave submission. */
  findRequesterContext(
    userId: string,
    tenantId: string,
  ): Promise<LeaveRequesterContextEntity | null>;

  /** Load approver identifiers for leave notification dispatch. */
  findApproverIdsForMobileLeaveNotification(input: {
    tenantId: string;
    siteId?: string | null;
  }): Promise<LeaveApproverEntity[]>;

  /** Find approved leave summary for a specific date. */
  findActiveLeaveForUserOnDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ): Promise<ActiveLeaveEntity | null>;

  /** Find approved tukar-libur dates for a specific date. */
  findApprovedTukarLiburForUserOnDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
    tenantId?: string,
  ): Promise<TukarLiburDateEntity | null>;
}
