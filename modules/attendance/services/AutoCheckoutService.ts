import { getTimezone } from "@/lib/utils/get-timezone";
import type { AttendanceAutoCheckoutJobData } from "@/lib/event-bus/queues";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";
import {
  buildAutoCheckoutWindow,
  enqueueAttendanceAutoCheckout,
  logAutoCheckoutEnqueueError,
  processAttendanceAutoCheckoutJob,
} from "./auto-checkout.helpers";

export class AutoCheckoutService {
  private static createAttendanceRepository() {
    return new AttendanceRepository();
  }

  private static createSessionPolicyService() {
    return new AttendanceSessionPolicyService();
  }

  /** Jalankan enqueue auto-checkout untuk satu tenant. */
  private static async runTenantAutoCheckout(tenantId: string) {
    const sessionPolicyService = this.createSessionPolicyService();
    const attendanceRepo = this.createAttendanceRepository();
    const timezone = await getTimezone(tenantId);
    const openAttendances = await this.findOpenAttendances(
      attendanceRepo,
      tenantId,
      timezone,
    );

    return this.enqueueTenantAttendances({
      tenantId,
      timezone,
      sessionPolicyService,
      openAttendances,
    });
  }

  /** Jalankan job auto-checkout untuk satu attendance yang sudah diantrikan. */
  static async runAutoCheckoutJob(data: AttendanceAutoCheckoutJobData) {
    const attendanceRepo = this.createAttendanceRepository();
    const sessionPolicyService = this.createSessionPolicyService();
    const timezone = await getTimezone(data.tenantId);
    const attendance = await attendanceRepo.findOpenSessionForAutoCheckout({
      attendanceId: data.attendanceId,
      tenantId: data.tenantId,
    });

    if (!attendance) {
      return { attendanceId: data.attendanceId, status: "noop" as const };
    }

    return processAttendanceAutoCheckoutJob({
      attendance,
      data,
      timezone,
      attendanceRepo,
      sessionPolicyService,
    });
  }

  /** Jalankan auto-checkout untuk satu tenant atau seluruh tenant aktif. */
  static async runAutoCheckout(tenantId?: string) {
    if (tenantId) return this.runTenantAutoCheckout(tenantId);
    const tenantIds = await TenantSettingsRepository.findActiveTenantIds();
    return this.runAllTenantAutoCheckout(tenantIds);
  }

  /** Ambil daftar sesi attendance terbuka dalam window auto-checkout. */
  private static async findOpenAttendances(
    attendanceRepo: AttendanceRepository,
    tenantId: string,
    timezone: string,
  ) {
    const now = new Date();
    const window = buildAutoCheckoutWindow(now, timezone);

    return attendanceRepo.findAllOpenSessionsWithUser(
      window.endOfToday,
      window.twentyFourHoursAgo,
      tenantId,
    );
  }

  /** Enqueue seluruh attendance terbuka tenant dan hitung hasil sukses. */
  private static async enqueueTenantAttendances(params: {
    tenantId: string;
    timezone: string;
    sessionPolicyService: AttendanceSessionPolicyService;
    openAttendances: Awaited<
      ReturnType<AttendanceRepository["findAllOpenSessionsWithUser"]>
    >;
  }) {
    const { tenantId, timezone, sessionPolicyService, openAttendances } =
      params;
    const now = new Date();
    let updatedCount = 0;

    for (const attendance of openAttendances) {
      try {
        const enqueued = await enqueueAttendanceAutoCheckout({
          attendance,
          tenantId,
          now,
          timezone,
          sessionPolicyService,
        });
        if (enqueued) updatedCount++;
      } catch (error) {
        logAutoCheckoutEnqueueError(attendance.id, error);
      }
    }

    return updatedCount;
  }

  /** Jalankan auto-checkout untuk semua tenant aktif. */
  private static async runAllTenantAutoCheckout(tenantIds: string[]) {
    let updatedCount = 0;

    for (const tenantId of tenantIds) {
      updatedCount += await this.runTenantAutoCheckout(tenantId);
    }

    return updatedCount;
  }
}
