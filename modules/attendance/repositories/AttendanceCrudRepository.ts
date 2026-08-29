import { prisma } from "@/lib/prisma";
import { Prisma, type AttendanceStatus } from "@prisma/client";

/**
 * Input pembuatan attendance sistem (absent, day off, leave sync, backdate).
 *
 * `checkInDate` wajib: unique index (userId, checkInDate, tenantId) adalah
 * satu-satunya proteksi duplikat per hari, dan Postgres memperlakukan NULL
 * sebagai nilai distinct sehingga baris ber-checkInDate NULL selalu lolos.
 */
export type CreateAttendanceWithIdInput = {
  id: string;
  userId: string;
  tenantId: string;
  checkIn: Date;
  checkInDate: Date;
  status: AttendanceStatus;
  notes: string;
  location: string;
  updatedAt: Date;
};

/**
 * Status placeholder harian yang dibuat sistem, bukan hasil kehadiran nyata.
 * PERMIT/SICK sengaja dikecualikan: itu keputusan persetujuan cuti, bukan tebakan.
 */
const LATE_ATTENDANCE_REPLACEMENT_SOURCE = "LATE_ATTENDANCE_REPLACEMENT";

const SYSTEM_GENERATED_PLACEHOLDER_STATUSES = [
  "ABSENT",
  "ALPHA",
  "DAY_OFF",
] as const;

export class AttendanceCrudRepository {
  /** Cari attendance tunggal dengan argumen Prisma. */
  async findUnique<T extends Prisma.AttendanceFindUniqueArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindUniqueArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T> | null> {
    return prisma.attendance.findUnique(params);
  }

  /** Cari banyak attendance dengan argumen Prisma. */
  async findMany<T extends Prisma.AttendanceFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindManyArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>[]> {
    return prisma.attendance.findMany(params);
  }

  /** Cari attendance pertama dengan argumen Prisma. */
  async findFirst<T extends Prisma.AttendanceFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceFindFirstArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T> | null> {
    return prisma.attendance.findFirst(params);
  }

  /** Update attendance dengan argumen Prisma penuh. */
  async updateByArgs<T extends Prisma.AttendanceUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceUpdateArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>> {
    return prisma.attendance.update(params);
  }

  /** Hapus satu attendance dengan argumen Prisma penuh. */
  async delete<T extends Prisma.AttendanceDeleteArgs>(
    params: Prisma.SelectSubset<T, Prisma.AttendanceDeleteArgs>,
  ): Promise<Prisma.AttendanceGetPayload<T>> {
    return prisma.attendance.delete(params);
  }

  /** Cari attendance pertama beserta user terpilih. */
  async findFirstWithUser(params: {
    where: Prisma.AttendanceWhereInput;
    orderBy?: Prisma.AttendanceOrderByWithRelationInput;
    userSelect?: Prisma.UserSelect;
  }) {
    return prisma.attendance.findFirst({
      where: params.where,
      orderBy: params.orderBy,
      include: { user: { select: params.userSelect } },
    });
  }

  /** Hitung attendance berdasarkan filter. */
  async count(where?: Prisma.AttendanceWhereInput) {
    return prisma.attendance.count({ ...(where ? { where } : {}) });
  }

  /** Update attendance by id. */
  async update(id: string, data: Prisma.AttendanceUpdateInput) {
    return prisma.attendance.update({ where: { id }, data });
  }

  /** Buat attendance baru. */
  async create(data: Prisma.AttendanceUncheckedCreateInput) {
    return prisma.attendance.create({ data });
  }

  /**
   * Buat baris check-in sambil melepas placeholder harian buatan sistem.
   *
   * Dipakai saat kehadiran nyata tiba setelah cron membuat ABSENT/DAY_OFF —
   * lazim pada sinkronisasi offline yang telat. Placeholder ditandai corrected
   * dan dilepas dari slot hariannya (checkInDate = null) agar unique index
   * (userId, checkInDate, tenantId) menerima baris kehadiran yang baru.
   */
  async createReplacingSystemGenerated(
    data: Prisma.AttendanceUncheckedCreateInput,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.attendance.updateMany({
        where: {
          userId: data.userId,
          tenantId: data.tenantId,
          checkInDate: data.checkInDate,
          correctedAt: null,
          status: { in: [...SYSTEM_GENERATED_PLACEHOLDER_STATUSES] },
        },
        data: {
          correctedAt: new Date(),
          checkInDate: null,
          correctionSource: LATE_ATTENDANCE_REPLACEMENT_SOURCE,
        },
      });
      return tx.attendance.create({ data });
    });
  }

  /** Cari attendance user pada rentang tanggal. */
  async findFirstByUserAndDateRange(input: {
    userId: string;
    tenantId: string;
    startOfDay: Date;
    endOfDay: Date;
  }) {
    return prisma.attendance.findFirst({
      where: {
        userId: input.userId,
        tenantId: input.tenantId,
        checkIn: { gte: input.startOfDay, lte: input.endOfDay },
      },
    });
  }

  /** Buat attendance dengan id eksplisit. */
  async createWithId(data: CreateAttendanceWithIdInput) {
    return prisma.attendance.create({
      data: {
        id: data.id,
        userId: data.userId,
        tenantId: data.tenantId,
        checkIn: data.checkIn,
        checkInDate: data.checkInDate,
        status: data.status,
        notes: data.notes,
        location: data.location,
        updatedAt: data.updatedAt,
      },
    });
  }

  /** Hapus banyak attendance berdasarkan filter. */
  async deleteMany(where: Prisma.AttendanceWhereInput) {
    return prisma.attendance.deleteMany({ where });
  }

  /** Ambil riwayat attendance user. */
  async findManyForHistory(input: {
    userId: string;
    tenantId?: string;
    skip: number;
    take: number;
    joinDate?: Date;
  }) {
    return prisma.attendance.findMany({
      where: {
        userId: input.userId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.joinDate ? { checkIn: { gte: input.joinDate } } : {}),
      },
      orderBy: { checkIn: "desc" },
      take: input.take,
      skip: input.skip,
    });
  }

  /** Hitung attendance user untuk pagination riwayat. */
  async countByUserId(userId: string, joinDate?: Date, tenantId?: string) {
    return prisma.attendance.count({
      where: {
        userId,
        ...(tenantId ? { tenantId } : {}),
        ...(joinDate ? { checkIn: { gte: joinDate } } : {}),
      },
    });
  }

  /** Ambil attendance untuk analytics user. */
  async findManyForAnalytics(input: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }) {
    return prisma.attendance.findMany({
      where: {
        userId: input.userId,
        checkIn: { gte: input.startDate, lte: input.endDate },
      },
      orderBy: { checkIn: "desc" },
    });
  }

  /** Aggregate attendance count grouped by status. */
  async groupByStatus(where: Prisma.AttendanceWhereInput) {
    return prisma.attendance.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
  }
}
