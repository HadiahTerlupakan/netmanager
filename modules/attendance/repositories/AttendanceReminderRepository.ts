import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ACTIVE_ATTENDANCE_STATUSES = [
  "ALPHA",
  "ABSENT",
  "DAY_OFF",
  "PERMIT",
  "SICK",
] as const;

export class AttendanceReminderRepository {
  /** Cari user yang sudah check-in hari ini. */
  async findCheckedInUserIds(startOfDay: Date, endOfDay: Date) {
    return prisma.attendance.findMany({
      where: { checkIn: { gte: startOfDay, lte: endOfDay } },
      select: { userId: true },
    });
  }

  /** Cari attendance incomplete dengan user penerima push. */
  async findIncompleteCheckOutWithUser(startOfDay: Date, endOfDay: Date) {
    return prisma.attendance.findMany({
      where: this.buildIncompleteCheckOutWhere(startOfDay, endOfDay, true),
      include: {
        user: { select: this.buildIncompleteCheckOutUserSelect(true) },
      },
      distinct: ["userId"],
    });
  }

  /** Cari attendance incomplete ringan untuk laporan. */
  async findIncompleteCheckOutSelect(startOfDay: Date, endOfDay: Date) {
    return prisma.attendance.findMany({
      where: this.buildIncompleteCheckOutWhere(startOfDay, endOfDay, false),
      select: { userId: true, user: { select: { name: true } } },
    });
  }

  /** Cari sesi flexible aktif yang perlu reminder checkout. */
  async findActiveFlexibleSessionsWithUser() {
    return prisma.attendance.findMany({
      where: this.buildFlexibleSessionWhere(),
      include: { user: { select: this.buildFlexibleSessionUserSelect() } },
    });
  }

  private buildFlexibleSessionWhere(): Prisma.AttendanceWhereInput {
    return {
      checkOut: null,
      user: {
        isActive: true,
        tenantId: { not: null },
        workingHourMode: "FLEXIBLE",
        OR: [{ pushToken: { not: null } }, { phone: { not: null } }],
      },
    };
  }

  private buildFlexibleSessionUserSelect() {
    return {
      id: true,
      name: true,
      flexibleTargetHour: true,
      pushToken: true,
      phone: true,
    } as const;
  }

  private buildIncompleteCheckOutUserSelect(includePushRecipient: boolean) {
    return {
      id: true,
      name: true,
      tenantId: true,
      startWorkTime: true,
      endWorkTime: true,
      workDays: true,
      ...(includePushRecipient ? { pushToken: true, phone: true } : {}),
    } as const;
  }

  private buildIncompleteCheckOutWhere(
    startOfDay: Date,
    endOfDay: Date,
    includePushRecipient: boolean,
  ): Prisma.AttendanceWhereInput {
    const user: Prisma.UserWhereInput = {
      workingHourMode: { not: "FLEXIBLE" },
      tenantId: { not: null },
      ...(includePushRecipient
        ? {
            isActive: true,
            endWorkTime: { not: null },
            OR: [{ pushToken: { not: null } }, { phone: { not: null } }],
          }
        : {}),
    };

    return {
      checkIn: { gte: startOfDay, lte: endOfDay },
      checkOut: null,
      status: { notIn: [...ACTIVE_ATTENDANCE_STATUSES] },
      user,
    };
  }
}
