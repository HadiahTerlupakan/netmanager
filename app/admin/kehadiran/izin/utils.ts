import { LeaveType, LeaveStatus } from "@prisma/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { LeaveCalendarEvent, LeaveConflict } from "./types";

/** Konversi data leave dari API ke format calendar event */
export function transformLeaveToCalendarEvent(leave: {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: string | Date;
  endDate: string | Date;
  status: LeaveStatus;
  reason?: string | null;
  user: {
    name: string;
  };
}): LeaveCalendarEvent {
  const startDate =
    typeof leave.startDate === "string"
      ? new Date(leave.startDate)
      : leave.startDate;
  const endDate =
    typeof leave.endDate === "string" ? new Date(leave.endDate) : leave.endDate;

  return {
    id: leave.id,
    title: `${leave.user.name} - ${getLeaveTypeLabel(leave.type)}`,
    start: startDate,
    end: endDate,
    resource: {
      userId: leave.userId,
      userName: leave.user.name,
      type: leave.type,
      status: leave.status,
      reason: leave.reason || undefined,
    },
  };
}

/** Deteksi konflik izin (overlap tanggal untuk user yang sama) */
export function detectLeaveConflicts(
  events: LeaveCalendarEvent[],
): LeaveConflict[] {
  const conflicts: LeaveConflict[] = [];
  const userLeaves = new Map<string, LeaveCalendarEvent[]>();

  // Group by userId
  events.forEach((event) => {
    const userId = event.resource.userId;
    if (!userLeaves.has(userId)) {
      userLeaves.set(userId, []);
    }
    userLeaves.get(userId)!.push(event);
  });

  // Check overlaps per user
  userLeaves.forEach((leaves, userId) => {
    for (let i = 0; i < leaves.length; i++) {
      const conflictingIds: string[] = [];

      for (let j = i + 1; j < leaves.length; j++) {
        if (
          isDateRangeOverlap(
            leaves[i].start,
            leaves[i].end,
            leaves[j].start,
            leaves[j].end,
          )
        ) {
          conflictingIds.push(leaves[j].id);
        }
      }

      if (conflictingIds.length > 0) {
        conflicts.push({
          leaveId: leaves[i].id,
          conflictingLeaveIds: conflictingIds,
          userId,
          userName: leaves[i].resource.userName,
          dateRange: {
            start: leaves[i].start,
            end: leaves[i].end,
          },
        });
      }
    }
  });

  return conflicts;
}

/** Check apakah dua range tanggal overlap */
function isDateRangeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  return start1 <= end2 && start2 <= end1;
}

/** Get label untuk tipe izin */
export function getLeaveTypeLabel(type: LeaveType): string {
  const labels: Record<LeaveType, string> = {
    CUTI: "Cuti",
    SAKIT: "Sakit",
    IZIN: "Izin",
    LAINNYA: "Lainnya",
    TUKAR_LIBUR: "Tukar Libur",
  };
  return labels[type] || type;
}

/** Get warna untuk status izin */
export function getLeaveStatusColor(status: LeaveStatus): string {
  const colors: Record<LeaveStatus, string> = {
    PENDING: "#f59e0b", // amber
    APPROVED: "#10b981", // green
    REJECTED: "#ef4444", // red
  };
  return colors[status] || "#6b7280"; // gray default
}

/** Format tanggal untuk tooltip */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = format(start, "d MMM yyyy", { locale: idLocale });
  const endStr = format(end, "d MMM yyyy", { locale: idLocale });

  if (startStr === endStr) {
    return startStr;
  }

  return `${startStr} - ${endStr}`;
}
