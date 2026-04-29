export type AttendanceWhereInput = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AttendanceQueryResult = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AttendanceQueryParams = any;

export interface IAttendanceRepository {
  /** Find one attendance record. */
  findUnique(
    params: AttendanceQueryParams,
  ): Promise<AttendanceQueryResult | null>;

  /** Find many attendance records. */
  findMany(params: AttendanceQueryParams): Promise<AttendanceQueryResult[]>;

  /** Update one attendance record by args. */
  updateByArgs(params: AttendanceQueryParams): Promise<AttendanceQueryResult>;

  /** Delete one attendance record. */
  delete(params: AttendanceQueryParams): Promise<AttendanceQueryResult>;

  /** Count attendance records. */
  count(where?: AttendanceWhereInput): Promise<number>;

  /** Find evaluation lookups for canonical status mapping. */
  findManyEvaluationLookups(params: {
    tenantId: string;
    userIds: string[];
    workDates: Date[];
  }): Promise<
    Array<{
      tenantId: string;
      userId: string;
      workDate: Date;
      finalStatus: string | null;
      reviewState: string | null;
      leaveState: string | null;
      holidayState: string | null;
      payrollHoldState: string | null;
      evidenceQuality: string | null;
      reasonCodes: unknown;
      anomalyCodes: unknown;
    }>
  >;

  /** Delete many attendance records. */
  deleteMany(where: AttendanceWhereInput): Promise<{ count: number }>;

  /** Find attendance within a user/date range. */
  findFirstByUserAndDateRange(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<AttendanceQueryResult | null>;

  /** Create attendance record. */
  create(params: AttendanceQueryParams): Promise<AttendanceQueryResult>;
}
