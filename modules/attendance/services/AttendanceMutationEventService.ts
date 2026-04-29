import { AttendanceEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";
import type { CheckInParams } from "./attendance-service.contracts";

export class AttendanceMutationEventService {
  /** Publish event check-in tanpa memblokir mutasi attendance. */
  publishCheckInEvent(
    params: CheckInParams,
    context: { checkInTime: Date },
    attendanceId: string,
  ) {
    AttendanceEventDispatcher.onCheckIn({
      userId: params.userId,
      attendanceId,
      timestamp: context.checkInTime.toISOString(),
      tenantId: params.tenantId,
      location: this.buildEventLocation(params),
    }).catch((error) => this.logPublishError("ATTENDANCE_CHECKIN", error));
  }

  /** Publish event check-out tanpa memblokir mutasi attendance. */
  publishCheckOutEvent(
    params: {
      userId: string;
      tenantId?: string;
      latitude?: number;
      longitude?: number;
    },
    attendance: { id: string; user: { name?: string | null } },
    checkOutTime: Date,
  ) {
    AttendanceEventDispatcher.onCheckOut({
      userId: params.userId,
      userName: attendance.user.name || undefined,
      attendanceId: attendance.id,
      timestamp: checkOutTime.toISOString(),
      tenantId: params.tenantId,
      location: this.buildEventLocation(params),
    }).catch((error) => this.logPublishError("ATTENDANCE_CHECKOUT", error));
  }

  private buildEventLocation(params: {
    latitude?: number;
    longitude?: number;
  }) {
    return params.latitude !== undefined && params.longitude !== undefined
      ? { lat: params.latitude, lng: params.longitude }
      : undefined;
  }

  private logPublishError(eventName: string, error: unknown) {
    logger.error(
      `Failed to publish ${eventName} event`,
      error instanceof Error ? error : undefined,
    );
  }
}
