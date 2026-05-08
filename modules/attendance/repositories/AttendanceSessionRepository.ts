import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getInactiveSessionStatuses } from "./attendance-repository-helpers";

const AUTO_CHECKOUT_INACTIVE_STATUSES = [
  "ALPHA",
  "ABSENT",
  "DAY_OFF",
  "PERMIT",
  "SICK",
] as const;

export class AttendanceSessionRepository {
  /** Cari semua sesi terbuka yang perlu evaluasi auto checkout. */
  async findAllOpenSessionsWithUser(input: {
    endOfToday: Date;
    twentyFourHoursAgo: Date;
    tenantId?: string;
  }) {
    return prisma.attendance.findMany({
      where: this.buildOpenSessionWhere(input),
      include: { user: { select: this.userScheduleSelect() } },
    });
  }

  /** Cari sesi terbuka tertentu untuk proses auto checkout. */
  async findOpenSessionForAutoCheckout(input: {
    attendanceId: string;
    tenantId: string;
  }) {
    return prisma.attendance.findFirst({
      where: this.buildAutoCheckoutWhere(input),
      include: { user: { select: this.userScheduleSelect() } },
    });
  }

  /** Update sesi terbuka yang masih valid untuk auto checkout. */
  async updateOpenSessionForAutoCheckout(input: {
    attendanceId: string;
    tenantId: string;
    data: Prisma.AttendanceUpdateInput;
  }) {
    const result = await prisma.attendance.updateMany({
      where: this.buildAutoCheckoutWhere(input),
      data: input.data,
    });
    return result.count;
  }

  /** Cari sesi aktif terbaru milik user untuk check-in guard. */
  async findFirstOpenSession(input: { userId: string; tenantId?: string }) {
    return prisma.attendance.findFirst({
      where: this.buildUserOpenSessionWhere(input),
      orderBy: { checkIn: "desc" },
      include: {
        user: {
          select: {
            workingHourMode: true,
            flexibleTargetHour: true,
            shift: { select: { startTime: true, endTime: true } },
          },
        },
      },
    });
  }

  /** Cari sesi lama yang belum checkout untuk user. */
  async findManyStaleSessions(input: {
    userId: string;
    effectiveToday: Date;
    tenantId?: string;
  }) {
    return prisma.attendance.findMany({
      where: {
        ...this.buildUserOpenSessionWhere(input),
        status: { notIn: [...AUTO_CHECKOUT_INACTIVE_STATUSES] },
        checkIn: { lt: input.effectiveToday },
      },
    });
  }

  /** Cari sesi aktif terbaru untuk proses checkout. */
  async findFirstActiveForCheckout(input: {
    userId: string;
    tenantId?: string;
  }) {
    return prisma.attendance.findFirst({
      where: this.buildUserOpenSessionWhere(input),
      orderBy: { checkIn: "desc" },
      include: {
        user: {
          select: {
            workingHourMode: true,
            attendanceGeofencePolicy: true,
            flexibleTargetHour: true,
            name: true,
          },
        },
      },
    });
  }

  /** Cari status attendance terbaru user. */
  async findFirstForCurrentStatus(input: {
    userId: string;
    tenantId?: string;
  }) {
    return prisma.attendance.findFirst({
      where: {
        userId: input.userId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      orderBy: { checkIn: "desc" },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true,
        user: {
          select: {
            workingHourMode: true,
            flexibleTargetHour: true,
            shift: { select: { startTime: true, endTime: true } },
          },
        },
      },
    });
  }

  private buildOpenSessionWhere(input: {
    endOfToday: Date;
    twentyFourHoursAgo: Date;
    tenantId?: string;
  }): Prisma.AttendanceWhereInput {
    return {
      checkOut: null,
      correctedAt: null,
      checkIn: { lte: input.endOfToday },
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      status: { notIn: [...getInactiveSessionStatuses()] },
      OR: [
        { user: { workingHourMode: { not: "FLEXIBLE" } } },
        {
          user: { workingHourMode: "FLEXIBLE" },
          checkIn: { lte: input.twentyFourHoursAgo },
        },
      ],
    };
  }

  private buildAutoCheckoutWhere(input: {
    attendanceId: string;
    tenantId: string;
  }): Prisma.AttendanceWhereInput {
    return {
      id: input.attendanceId,
      tenantId: input.tenantId,
      checkOut: null,
      correctedAt: null,
      status: { notIn: [...AUTO_CHECKOUT_INACTIVE_STATUSES] },
    };
  }

  private buildUserOpenSessionWhere(input: {
    userId: string;
    tenantId?: string;
  }): Prisma.AttendanceWhereInput {
    return {
      userId: input.userId,
      checkOut: null,
      correctedAt: null,
      status: { notIn: [...AUTO_CHECKOUT_INACTIVE_STATUSES] },
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    };
  }

  private userScheduleSelect() {
    return {
      name: true,
      workingHourMode: true,
      startWorkTime: true,
      endWorkTime: true,
      shift: true,
    } satisfies Prisma.UserSelect;
  }
}
