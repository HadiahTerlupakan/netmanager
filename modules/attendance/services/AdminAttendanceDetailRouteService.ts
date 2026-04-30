import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logActivitySafe } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { calculateAttendanceStatus } from "../utils/attendanceStatus";
import type { AttendanceUpdate } from "../validators/attendance";
import { AttendanceSettingsService } from "./AttendanceSettingsService";
import type {
  AdminAttendanceUser,
  AttendanceUpdateInput,
  DetailResult,
  RestrictedScope,
  SessionUser,
} from "./admin-attendance-detail-route.types";

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

async function getRestrictedScope(user: SessionUser): Promise<RestrictedScope> {
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
}): Promise<AttendanceUpdateInput> {
  const updateData = buildBaseAttendanceUpdateData(input.payload);
  const recalculatedStatus = await resolveRecalculatedStatus(input);
  if (recalculatedStatus) {
    updateData.status = recalculatedStatus;
    return updateData;
  }
  if (input.payload.status) updateData.status = input.payload.status;
  return updateData;
}

function buildBaseAttendanceUpdateData(payload: AttendanceUpdate) {
  const updateData: AttendanceUpdateInput = {};
  if (payload.checkIn) updateData.checkIn = new Date(payload.checkIn);
  if (payload.checkOut !== undefined) {
    updateData.checkOut = payload.checkOut ? new Date(payload.checkOut) : null;
  }
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  return updateData;
}

async function resolveRecalculatedStatus(input: {
  payload: AttendanceUpdate;
  attendanceUser: AdminAttendanceUser;
  settingsService: AttendanceSettingsService;
}) {
  const scheduledStartTime = getScheduledStartTime(input.attendanceUser);
  if (
    !shouldRecalculateStatus(
      input.payload.checkIn,
      scheduledStartTime,
      input.attendanceUser,
    )
  ) {
    return null;
  }

  const settingsMap = await getAttendanceSettingsMap(input.settingsService);
  return calculateAttendanceStatus({
    checkInTime: new Date(input.payload.checkIn as string),
    scheduleTime: scheduledStartTime as string,
    timezone: settingsMap.get("GENERAL_TIMEZONE") || "Asia/Jakarta",
    toleranceMinutes: parseToleranceMinutes(
      settingsMap.get("GENERAL_ATTENDANCE_TOLERANCE"),
    ),
  });
}

function shouldRecalculateStatus(
  checkIn: string | Date | undefined,
  scheduledStartTime: string | null,
  attendanceUser: AdminAttendanceUser,
) {
  return Boolean(
    checkIn &&
    scheduledStartTime &&
    attendanceUser.workingHourMode !== "FLEXIBLE",
  );
}

async function getAttendanceSettingsMap(
  settingsService: AttendanceSettingsService,
) {
  const settings = await settingsService.findManyByKeys([
    "GENERAL_ATTENDANCE_TOLERANCE",
    "GENERAL_TIMEZONE",
  ]);
  return new Map(settings.map((setting) => [setting.key, setting.value]));
}

function parseToleranceMinutes(value: string | undefined) {
  return Number.parseInt(value || "0", 10) || 0;
}

export class AdminAttendanceDetailRouteService {
  constructor(
    private readonly attendanceRepository: IAttendanceRepository = new AttendanceRepository(),
    private readonly settingsService = new AttendanceSettingsService(),
  ) {}

  /** Gets one admin attendance record with scope enforcement. */
  async getAttendance(id: string, user: SessionUser) {
    const attendance = await this.findAttendanceDetail(id);
    if (!attendance || isBeforeJoinDate(attendance)) {
      return this.createNotFoundResult();
    }
    if (await isOutsideScope(attendance.user, user)) {
      return this.createNotFoundResult();
    }
    return { type: "success", data: attendance } as const;
  }

  /** Updates one admin attendance record with scope enforcement. */
  async updateAttendance(
    id: string,
    user: SessionUser,
    payload: AttendanceUpdate,
  ) {
    const attendance = await this.findAttendanceForUpdate(id);
    const validationResult = await this.validateMutableAttendance(
      attendance,
      user,
    );
    if (validationResult) return validationResult;

    const updateData = await buildAttendanceUpdateData({
      payload,
      attendanceUser: attendance.user,
      settingsService: this.settingsService,
    });
    const updated = await this.updateAttendanceRecord(id, updateData);
    this.logAttendanceActivity("UPDATE", user.id, { id, updates: updateData });

    return {
      type: "success",
      data: updated,
      message: "Absensi berhasil diperbarui",
    } as const;
  }

  /** Deletes one admin attendance record with scope enforcement. */
  async deleteAttendance(id: string, user: SessionUser) {
    const attendance = await this.findAttendanceForDelete(id);
    if (!attendance) return this.createNotFoundResult();
    if (await isOutsideScope(attendance.user, user)) {
      return this.createNotFoundResult();
    }

    await this.attendanceRepository.delete({ where: { id } });
    this.logAttendanceActivity("DELETE", user.id, { id });

    return {
      type: "success",
      data: { id },
      message: "Absensi berhasil dihapus",
    } as const;
  }

  private async findAttendanceDetail(id: string) {
    return this.attendanceRepository.findUnique({
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
  }

  private async findAttendanceForUpdate(id: string) {
    return this.attendanceRepository.findUnique({
      where: { id },
      include: { user: { include: { shift: true } } },
    });
  }

  private async findAttendanceForDelete(id: string) {
    return this.attendanceRepository.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  private async validateMutableAttendance(
    attendance: Awaited<ReturnType<typeof this.findAttendanceForUpdate>>,
    user: SessionUser,
  ) {
    if (!attendance) return this.createNotFoundResult();
    if (isBeforeJoinDate(attendance)) {
      return {
        type: "badRequest",
        message: "Absensi sebelum tanggal masuk tidak boleh diubah",
      } as const;
    }
    if (await isOutsideScope(attendance.user, user)) {
      return this.createNotFoundResult();
    }
    return null;
  }

  private updateAttendanceRecord(
    id: string,
    data: Prisma.AttendanceUpdateInput,
  ) {
    return this.attendanceRepository.updateByArgs({
      where: { id },
      data,
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
  }

  private logAttendanceActivity(
    action: "UPDATE" | "DELETE",
    userId: string,
    details: Record<string, unknown>,
  ) {
    logActivitySafe({
      action,
      subject: "Attendance",
      userId,
      details,
    });
  }

  private createNotFoundResult() {
    return {
      type: "notFound",
      message: "Data absensi tidak ditemukan",
    } as const;
  }
}

export type AdminAttendanceDetailResult<T> = DetailResult<T>;
