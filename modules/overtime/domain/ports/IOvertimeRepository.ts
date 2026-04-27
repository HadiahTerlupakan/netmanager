import type {
  OvertimeAutoCheckoutScheduleEntity,
  OvertimeCountByStatusEntity,
  OvertimeDateStatsEntity,
  OvertimeEntity,
  OvertimeGroupedStatsEntity,
  OvertimeRangeStatsEntity,
  OvertimeStatusValue,
  OvertimeTopEmployeeEntity,
  OvertimeUserStatsEntity,
} from "../entities/OvertimeEntity";

export interface OvertimeQueryFilters {
  userId?: string;
  status?: OvertimeStatusValue;
  startDate?: Date;
  endDate?: Date;
  siteId?: string;
  departmentId?: string;
  holidayType?: string;
  skip?: number;
  take?: number;
  tenantId?: string;
}

export interface OvertimeStatusCountFilters {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  siteId?: string;
  departmentId?: string;
  tenantId?: string;
}

export interface OvertimeCreateInput {
  userId: string;
  reason: string;
  status: OvertimeStatusValue;
  tenantId?: string;
}

export interface OvertimeUpdateInput {
  status?: OvertimeStatusValue;
  startTime?: Date;
  startPhoto?: string;
  startLocation?: string;
  endTime?: Date;
  endPhoto?: string;
  endLocation?: string;
  duration?: number;
  approvedBy?: string;
  rejectionReason?: string;
  attendanceId?: string;
  isHolidayOvertime?: boolean;
  isNationalHoliday?: boolean;
  isOffDay?: boolean;
  holidayDescription?: string | null;
  reason?: string;
}

export interface UpsertOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  scheduledFor: Date;
  jobId?: string | null;
}

export interface CancelOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  cancelledAt: Date;
}

export interface CompleteOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  executedAt: Date;
  scheduleStatus: "COMPLETED" | "FAILED";
  lastError: string | null;
}

export interface CompleteScheduledAutoCheckoutInput {
  scheduleId: string;
  overtimeId: string;
  version: number;
  executedAt: Date;
  endTime: Date;
  duration: number;
}

export interface BatchOperationResult {
  count: number;
}

export interface IOvertimeRepository {
  /** Find one overtime by id. */
  findById(id: string, tenantId?: string): Promise<OvertimeEntity | null>;

  /** Find active overtime request on a date range. */
  findActiveRequestByDate(
    userId: string,
    tenantId: string | undefined,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<OvertimeEntity | null>;

  /** Find overtime records by filters. */
  findAll(filters?: OvertimeQueryFilters): Promise<OvertimeEntity[]>;

  /** Count overtime records by filters. */
  count(filters?: OvertimeQueryFilters): Promise<number>;

  /** Count overtime records grouped by status. */
  countByStatus(
    filters?: OvertimeStatusCountFilters,
  ): Promise<OvertimeCountByStatusEntity>;

  /** Create new overtime record. */
  create(data: OvertimeCreateInput): Promise<OvertimeEntity>;

  /** Update overtime record. */
  update(id: string, data: OvertimeUpdateInput): Promise<OvertimeEntity>;

  /** Delete overtime record. */
  delete(id: string): Promise<void>;

  /** Get aggregate report stats by date range. */
  getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<OvertimeRangeStatsEntity>;

  /** Get daily overtime stats. */
  getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ): Promise<OvertimeDateStatsEntity[]>;

  /** Get grouped overtime stats. */
  getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
  ): Promise<OvertimeGroupedStatsEntity[]>;

  /** Get top employees by overtime duration. */
  getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit?: number,
    siteId?: string,
    departmentId?: string,
  ): Promise<OvertimeTopEmployeeEntity[]>;

  /** Get user overtime grouped stats. */
  getUserOvertimeStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ): Promise<OvertimeUserStatsEntity[]>;

  /** Find auto checkout schedule by id. */
  findAutoCheckoutScheduleById(
    id: string,
  ): Promise<OvertimeAutoCheckoutScheduleEntity | null>;

  /** Find auto checkout schedule by overtime id. */
  findAutoCheckoutScheduleByOvertimeId(
    overtimeId: string,
  ): Promise<OvertimeAutoCheckoutScheduleEntity | null>;

  /** Find schedules that need queue rehydration. */
  findSchedulesForRehydration(
    now: Date,
  ): Promise<OvertimeAutoCheckoutScheduleEntity[]>;

  /** Attach queue job id to schedule. */
  attachAutoCheckoutJobId(
    overtimeId: string,
    jobId: string,
  ): Promise<OvertimeAutoCheckoutScheduleEntity>;

  /** Upsert auto checkout schedule. */
  upsertAutoCheckoutSchedule(
    input: UpsertOvertimeAutoCheckoutScheduleInput,
  ): Promise<OvertimeAutoCheckoutScheduleEntity>;

  /** Cancel scheduled auto checkout. */
  cancelAutoCheckoutSchedule(
    input: CancelOvertimeAutoCheckoutScheduleInput,
  ): Promise<BatchOperationResult>;

  /** Mark schedule completed or failed. */
  completeAutoCheckoutSchedule(
    input: CompleteOvertimeAutoCheckoutScheduleInput,
  ): Promise<OvertimeAutoCheckoutScheduleEntity>;

  /** Complete overtime and schedule atomically. */
  completeScheduledAutoCheckout(
    input: CompleteScheduledAutoCheckoutInput,
  ): Promise<boolean>;
}
