import { prisma } from "@/lib/prisma";
import { Prisma, type AttendanceStatus } from "@prisma/client";

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
  async createWithId(data: {
    id: string;
    userId: string;
    tenantId: string;
    checkIn: Date;
    status: AttendanceStatus;
    notes: string;
    location: string;
    updatedAt: Date;
  }) {
    return prisma.attendance.create({
      data: {
        id: data.id,
        userId: data.userId,
        tenantId: data.tenantId,
        checkIn: data.checkIn,
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
    skip: number;
    take: number;
    joinDate?: Date;
  }) {
    return prisma.attendance.findMany({
      where: {
        userId: input.userId,
        ...(input.joinDate ? { checkIn: { gte: input.joinDate } } : {}),
      },
      orderBy: { checkIn: "desc" },
      take: input.take,
      skip: input.skip,
    });
  }

  /** Hitung attendance user untuk pagination riwayat. */
  async countByUserId(userId: string, joinDate?: Date) {
    return prisma.attendance.count({
      where: {
        userId,
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
}
