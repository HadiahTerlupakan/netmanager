import type { Prisma } from "../../repositories/prisma-boundary";

export interface IAttendanceRepository {
  /** Find one attendance record. */
  findUnique(params: Prisma.AttendanceFindUniqueArgs): Promise<unknown>;

  /** Find many attendance records. */
  findMany(params: Prisma.AttendanceFindManyArgs): Promise<unknown[]>;

  /** Update one attendance record by args. */
  updateByArgs(params: Prisma.AttendanceUpdateArgs): Promise<unknown>;

  /** Delete one attendance record. */
  delete(params: Prisma.AttendanceDeleteArgs): Promise<unknown>;

  /** Count attendance records. */
  count(where?: Prisma.AttendanceWhereInput): Promise<number>;

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
  deleteMany(where: Prisma.AttendanceWhereInput): Promise<{ count: number }>;

  /** Find attendance within a user/date range. */
  findFirstByUserAndDateRange(
    userId: string,
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<unknown>;

  /** Create attendance record. */
  create(params: Prisma.AttendanceUncheckedCreateInput): Promise<unknown>;
}
