import type {
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
} from "../types/attendance.enums";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";

const LEAVE_NOTES_MARKER = "Leave";

type LeaveWithUser = {
  id: string;
  userId: string;
  tenantId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  status: LeaveStatus;
  user: {
    workDays: string | null;
    joinDate: Date | null;
  };
};

const DEFAULT_WORK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export class LeaveAttendanceSyncService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly holidayRepository: HolidayRepository,
  ) {}

  /** Sync approved leave range into attendance records. */
  async syncLeaveToAttendance(leave: LeaveWithUser): Promise<void> {
    const dateCursor = this.getStartDate(leave.startDate);
    const lastDate = this.getStartDate(leave.endDate);
    const allowedDays = this.getAllowedDays(leave.user.workDays);
    const status = this.getAttendanceStatus(leave.type);

    while (dateCursor <= lastDate) {
      await this.syncLeaveDate(leave, dateCursor, allowedDays, status);
      dateCursor.setDate(dateCursor.getDate() + 1);
    }
  }

  /** Remove auto-generated leave attendance records for a leave range. */
  async revertLeaveFromAttendance(leave: LeaveWithUser): Promise<void> {
    const startDate = this.getStartDate(leave.startDate);
    const endDate = new Date(leave.endDate);
    endDate.setTime(toEndOfDay(endDate).getTime());

    await this.attendanceRepository.deleteMany({
      userId: leave.userId,
      tenantId: leave.tenantId,
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ["SICK", "PERMIT", "DAY_OFF"] },
      notes: { contains: LEAVE_NOTES_MARKER },
    });
  }

  private async syncLeaveDate(
    leave: LeaveWithUser,
    date: Date,
    allowedDays: string[],
    status: AttendanceStatus,
  ) {
    if (this.isBeforeJoinDate(date, leave.user.joinDate)) return;
    if (!allowedDays.includes(DAY_NAMES[date.getDay()])) return;
    if (await this.isHoliday(date, leave.tenantId)) return;

    const existingAttendance = await this.findExistingAttendance(leave, date);
    if (existingAttendance) {
      await this.updateAttendanceIfNeeded(
        existingAttendance,
        leave.type,
        status,
      );
      return;
    }

    await this.createLeaveAttendance(leave, date, status);
  }

  private getAttendanceStatus(type: LeaveType): AttendanceStatus {
    if (type === "SAKIT") return "SICK";
    if (type === "TUKAR_LIBUR") return "DAY_OFF";
    return "PERMIT";
  }

  private getAllowedDays(workDays: string | null) {
    return workDays
      ? workDays.split(",").map((day) => day.trim())
      : DEFAULT_WORK_DAYS;
  }

  private isBeforeJoinDate(date: Date, joinDate: Date | null) {
    if (!joinDate) return false;
    return date < this.getStartDate(joinDate);
  }

  private async isHoliday(date: Date, tenantId: string) {
    const { isHoliday } = await this.holidayRepository.isHoliday(
      date,
      tenantId,
    );
    return isHoliday;
  }

  private async findExistingAttendance(leave: LeaveWithUser, date: Date) {
    const dayStart = this.getStartDate(date);
    const dayEnd = new Date(date);
    dayEnd.setTime(toEndOfDay(dayEnd).getTime());

    return this.attendanceRepository.findFirst({
      where: {
        userId: leave.userId,
        checkIn: { gte: dayStart, lte: dayEnd },
        tenantId: leave.tenantId,
      },
    });
  }

  private async updateAttendanceIfNeeded(
    attendance: { id: string; status: AttendanceStatus; notes?: string | null },
    leaveType: LeaveType,
    status: AttendanceStatus,
  ) {
    const leaveMarker = `(${leaveType})`;
    const shouldUpdateNotes = !attendance.notes?.includes(leaveMarker);
    if (attendance.status === status && !shouldUpdateNotes) return;

    await this.attendanceRepository.update(attendance.id, {
      status,
      notes: attendance.notes
        ? `${attendance.notes} | Updated by Leave Approval (${leaveType})`
        : `Updated by Leave Approval (${leaveType})`,
    });
  }

  private async createLeaveAttendance(
    leave: LeaveWithUser,
    date: Date,
    status: AttendanceStatus,
  ) {
    await this.attendanceRepository.createWithId({
      id: crypto.randomUUID(),
      userId: leave.userId,
      tenantId: leave.tenantId,
      checkIn: this.getStartDate(date),
      status,
      notes: `Auto-generated from Leave Request (${leave.type})`,
      location: "System (Auto-Sync)",
      updatedAt: new Date(),
    });
  }

  private getStartDate(date: Date) {
    const startDate = new Date(date);
    startDate.setTime(toStartOfDay(startDate).getTime());
    return startDate;
  }
}
