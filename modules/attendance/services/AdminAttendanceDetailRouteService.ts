import { Prisma } from "@prisma/client";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logActivitySafe } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { AttendanceUpdate } from "../validators/attendance";
import { calculateAttendanceStatus } from "../utils/attendanceStatus";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AttendanceSettingsService } from "./AttendanceSettingsService";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";

type AdminAttendanceUser = {
  id: string;
  workingHourMode?: string | null;
  startWorkTime?: string | null;
  shift?: { startTime?: string | null } | null;
};

type SessionUser = {
  id: string;
  isSuperAdmin?: boolean;
};

type DetailResult<T> =
  | { type: "success"; data: T; message?: string }
  | { type: "notFound"; message: string }
  | { type: "badRequest"; message: string };

function isBeforeJoinDate(attendance: {
  checkIn: Date;
  user: { joinDate?: Date | null };
}) {
  return Boolean(
    attendance.user.joinDate && attendance.checkIn < attendance.user.joinDate,
  );
}

function getScheduledStartTime(user: AdminAttendanceUser) {
  if (user.workingHourMode === "SHIFT") {
    return user.shift?.startTime ?? user.startWorkTime ?? null;
  }

  return user.startWorkTime ?? null;
}

async function getRestrictedScope(user: SessionUser) {
  const permissions = await getUserPermissions(user.id);
  if (isSuperAdmin(user)) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, departmentId: true },
  });

  return {
    siteId: permissions.includes("attendance:site_only")
      ? dbUser?.siteId
      : null,
    departmentId: permissions.includes("attendance:department_only")
      ? dbUser?.departmentId
      : null,
  };
}

async function isOutsideScope(
  attendanceUser: { siteId?: string | null; departmentId?: string | null },
  user: SessionUser,
) {
  const scope = await getRestrictedScope(user);
  if (!scope) return false;
  if (scope.siteId && attendanceUser.siteId !== scope.siteId) return true;
  return Boolean(
    scope.departmentId && attendanceUser.departmentId !== scope.departmentId,
  );
}

async function buildAttendanceUpdateData(input: {
  payload: AttendanceUpdate;
  attendanceUser: AdminAttendanceUser;
  settingsService: AttendanceSettingsService;
}): Promise<Prisma.AttendanceUpdateInput> {
  const updateData: Prisma.AttendanceUpdateInput = {};
  if (input.payload.checkIn)
    updateData.checkIn = new Date(input.payload.checkIn);
  if (input.payload.checkOut !== undefined) {
    updateData.checkOut = input.payload.checkOut
      ? new Date(input.payload.checkOut)
      : null;
  }
  if (input.payload.notes !== undefined) updateData.notes = input.payload.notes;

  const scheduledStartTime = getScheduledStartTime(input.attendanceUser);
  const shouldRecalculateStatus = Boolean(
    input.payload.checkIn &&
    scheduledStartTime &&
    input.attendanceUser.workingHourMode !== "FLEXIBLE",
  );

  if (shouldRecalculateStatus && input.payload.checkIn && scheduledStartTime) {
    const settings = await input.settingsService.findManyByKeys([
      "GENERAL_ATTENDANCE_TOLERANCE",
      "GENERAL_TIMEZONE",
    ]);
    const settingsMap = new Map(
      settings.map((setting) => [setting.key, setting.value]),
    );
    updateData.status = calculateAttendanceStatus({
      checkInTime: new Date(input.payload.checkIn),
      scheduleTime: scheduledStartTime,
      timezone: settingsMap.get("GENERAL_TIMEZONE") || "Asia/Jakarta",
      toleranceMinutes:
        Number.parseInt(
          settingsMap.get("GENERAL_ATTENDANCE_TOLERANCE") || "0",
          10,
        ) || 0,
    });
    return updateData;
  }

  if (input.payload.status) updateData.status = input.payload.status;
  return updateData;
}

export class AdminAttendanceDetailRouteService {
  constructor(
    private readonly attendanceRepository: IAttendanceRepository = new AttendanceRepository(),
    private readonly settingsService = new AttendanceSettingsService(),
  ) {}

  /** Gets one admin attendance record with scope enforcement. */
  async getAttendance(id: string, user: SessionUser) {
    const attendance = await this.attendanceRepository.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            siteId: true,
            departmentId: true,
            joinDate: true,
            departments: { select: { name: true } },
            sites: { select: { name: true } },
          },
        },
      },
    });

    if (!attendance || isBeforeJoinDate(attendance)) {
      return {
        type: "notFound",
        message: "Data absensi tidak ditemukan",
      } as const;
    }
    if (await isOutsideScope(attendance.user, user)) {
      return {
        type: "notFound",
        message: "Data absensi tidak ditemukan",
      } as const;
    }

    return { type: "success", data: attendance } as const;
  }

  /** Updates one admin attendance record with scope enforcement. */
  async updateAttendance(
    id: string,
    user: SessionUser,
    payload: AttendanceUpdate,
  ) {
    const attendance = await this.attendanceRepository.findUnique({
      where: { id },
      include: { user: { include: { shift: true } } },
    });

    if (!attendance) {
      return {
        type: "notFound",
        message: "Data absensi tidak ditemukan",
      } as const;
    }
    if (isBeforeJoinDate(attendance)) {
      return {
        type: "badRequest",
        message: "Absensi sebelum tanggal masuk tidak boleh diubah",
      } as const;
    }
    if (await isOutsideScope(attendance.user, user)) {
      return {
        type: "notFound",
        message: "Data absensi tidak ditemukan",
      } as const;
    }

    const updateData = await buildAttendanceUpdateData({
      payload,
      attendanceUser: attendance.user,
      settingsService: this.settingsService,
    });
    const updated = await this.attendanceRepository.updateByArgs({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true,
            departments: { select: { name: true } },
            sites: { select: { name: true } },
          },
        },
      },
    });

    logActivitySafe({
      action: "UPDATE",
      subject: "Attendance",
      userId: user.id,
      details: { id, updates: updateData },
    });

    return {
      type: "success",
      data: updated,
      message: "Absensi berhasil diperbarui",
    } as const;
  }

  /** Deletes one admin attendance record with scope enforcement. */
  async deleteAttendance(id: string, user: SessionUser) {
    const attendance = await this.attendanceRepository.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!attendance) {
      return {
        type: "notFound",
        message: "Data absensi tidak ditemukan",
      } as const;
    }
    if (await isOutsideScope(attendance.user, user)) {
      return {
        type: "notFound",
        message: "Data absensi tidak ditemukan",
      } as const;
    }

    await this.attendanceRepository.delete({ where: { id } });
    logActivitySafe({
      action: "DELETE",
      subject: "Attendance",
      userId: user.id,
      details: { id },
    });

    return {
      type: "success",
      data: { id },
      message: "Absensi berhasil dihapus",
    } as const;
  }
}

export type AdminAttendanceDetailResult<T> = DetailResult<T>;
