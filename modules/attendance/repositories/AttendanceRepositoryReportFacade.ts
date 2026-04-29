import { Prisma } from "@prisma/client";
import { AttendanceCrudRepository } from "./AttendanceCrudRepository";
import { AttendanceReportDelegates } from "./AttendanceReportDelegates";

export abstract class AttendanceRepositoryReportFacade {
  protected readonly crudRepository = new AttendanceCrudRepository();
  private readonly reportDelegates = new AttendanceReportDelegates();

  /** Cari attendance tunggal dengan argumen Prisma. */
  async findUnique<T extends Prisma.AttendanceFindUniqueArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindUniqueArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T> | null> {
    return this.crudRepository.findUnique(params);
  }

  /** Cari banyak attendance dengan argumen Prisma. */
  async findMany<T extends Prisma.AttendanceFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindManyArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>[]> {
    return this.crudRepository.findMany(params);
  }

  /** Cari attendance pertama dengan argumen Prisma. */
  async findFirst<T extends Prisma.AttendanceFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindFirstArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T> | null> {
    return this.crudRepository.findFirst(params);
  }

  /** Update attendance dengan argumen Prisma penuh. */
  async updateByArgs<T extends Prisma.AttendanceUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceUpdateArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>> {
    return this.crudRepository.updateByArgs(params);
  }

  /** Hapus satu attendance dengan argumen Prisma penuh. */
  async delete<T extends Prisma.AttendanceDeleteArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceDeleteArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>> {
    return this.crudRepository.delete(params);
  }

  /** Cari attendance pertama beserta user terpilih. */
  async findFirstWithUser(params: {
    where: Prisma.AttendanceWhereInput;
    orderBy?: Prisma.AttendanceOrderByWithRelationInput;
    userSelect?: Prisma.UserSelect;
  }) {
    return this.crudRepository.findFirstWithUser(params);
  }

  /** Hitung attendance berdasarkan filter. */
  async count(where?: Prisma.AttendanceWhereInput) {
    return this.crudRepository.count(where);
  }

  /** Ambil statistik attendance rentang tanggal. */
  async getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik evaluasi attendance rentang tanggal. */
  async getEvaluationStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getEvaluationStatsByDateRange(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik harian attendance. */
  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.reportDelegates.getDailyStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Ambil statistik attendance berdasarkan group. */
  async getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
    tenantId?: string,
  ) {
    return this.reportDelegates.getGroupedStats(
      startDate,
      endDate,
      groupBy,
      tenantId,
    );
  }

  /** Ambil top employee attendance. */
  async getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getTopEmployees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  /** Ambil top absentee attendance. */
  async getTopAbsentees(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getTopAbsentees(
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik attendance per user. */
  async getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    return this.reportDelegates.getUserAttendanceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    );
  }

  /** Ambil statistik absence per user. */
  async getUserAbsenceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getUserAbsenceStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil record attendance per user. */
  async getUserAttendanceRecords(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getUserAttendanceRecords(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil total durasi attendance per user. */
  async getUserTotalDuration(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getUserTotalDuration(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }

  /** Ambil statistik keterlambatan per user. */
  async getUserLateStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportDelegates.getUserLateStats(
      startDate,
      endDate,
      siteId,
      departmentId,
    );
  }
}
