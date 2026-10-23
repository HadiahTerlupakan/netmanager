import { eventBus, EVENT_NAMES } from '@/lib/event-bus';

export class AttendanceEventDispatcher {
  /**
   * Dipanggil setelah user melakukan check-in.
   */
  static async onCheckIn(data: {
    userId: string
    userName?: string
    attendanceId: string
    timestamp: string
    tenantId?: string
    location?: { lat: number; lng: number }
  }) {
    await eventBus.publish(EVENT_NAMES.ATTENDANCE_CHECKIN, {
      userId: data.userId,
      userName: data.userName,
      attendanceId: data.attendanceId,
      type: 'checkin',
      timestamp: data.timestamp,
      tenantId: data.tenantId,
      location: data.location,
    });
  }

  /**
   * Dipanggil setelah user melakukan check-out.
   */
  static async onCheckOut(data: {
    userId: string
    userName?: string
    attendanceId: string
    timestamp: string
    tenantId?: string
    location?: { lat: number; lng: number }
  }) {
    await eventBus.publish(EVENT_NAMES.ATTENDANCE_CHECKOUT, {
      userId: data.userId,
      userName: data.userName,
      attendanceId: data.attendanceId,
      type: 'checkout',
      timestamp: data.timestamp,
      tenantId: data.tenantId,
      location: data.location,
    });
  }

  /**
   * Dipanggil ketika user tidak hadir (absent).
   */
  static async onAbsent(data: {
    userId: string
    userName?: string
    attendanceId: string
    timestamp: string
    tenantId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.ATTENDANCE_ABSENT, {
      userId: data.userId,
      userName: data.userName,
      attendanceId: data.attendanceId,
      type: 'absent',
      timestamp: data.timestamp,
      tenantId: data.tenantId,
    });
  }
}
