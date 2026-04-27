import type { Prisma } from "@prisma/client";

export interface IAttendanceRepository {
  /** Find many attendance records. */
  findMany<T extends Prisma.AttendanceFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindManyArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>[]>;

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
}
