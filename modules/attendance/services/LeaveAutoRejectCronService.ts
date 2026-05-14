import { logger } from "@/lib/logger";
import { getLeaveService } from "./LeaveService";
import { LeaveTimelineService } from "./LeaveTimelineService";
import { DEFAULT_AUTO_REJECT_SETTINGS } from "./AutoRejectService";
import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";
import { LeaveRequestRepository } from "../repositories/LeaveRequestRepository";

export interface AutoRejectCronResult {
  rejectedCount: number;
  rejectedIds: string[];
  checkedAt: string;
}

/** Cron service untuk auto-reject leave request yang sudah melewati deadline. */
export async function autoRejectExpiredLeaves(
  now = new Date(),
): Promise<AutoRejectCronResult> {
  const leaveService = getLeaveService();
  const timelineService = new LeaveTimelineService();
  const settingsRepository = new TenantSettingsRepository();
  const leaveRequestRepository = new LeaveRequestRepository();
  const settingsCache = new Map<
    string,
    Awaited<ReturnType<typeof settingsRepository.getAutoRejectSettings>>
  >();

  const pendingLeaves = await leaveRequestRepository.findPendingForReminder();

  const rejectedIds: string[] = [];

  for (const leave of pendingLeaves) {
    try {
      if (!leave.tenantId) continue;

      if (!settingsCache.has(leave.tenantId)) {
        const fetched = await settingsRepository.getAutoRejectSettings(
          leave.tenantId,
        );
        settingsCache.set(leave.tenantId, fetched);
      }
      const settings =
        settingsCache.get(leave.tenantId) ?? DEFAULT_AUTO_REJECT_SETTINGS;

      const timelineSettings = {
        enableTimelineAutoReject: settings.enableTimelineAutoReject,
        mendadakDeadlineHours: settings.mendadakDeadlineHours,
        mendadakReminder1Hours: settings.mendadakReminder1Hours,
        mendadakReminder2Hours: settings.mendadakReminder2Hours,
        normalDeadlineDays: settings.normalDeadlineDays,
        normalReminder1Days: settings.normalReminder1Days,
        normalReminder2Days: settings.normalReminder2Days,
        advanceDeadlineDays: settings.advanceDeadlineDays,
        advanceReminder1Days: settings.advanceReminder1Days,
        advanceReminder2Days: settings.advanceReminder2Days,
        advanceReminder3Days: settings.advanceReminder3Days,
      };

      const shouldReject = timelineService.checkShouldAutoReject(
        leave.submittedAt,
        leave.startDate,
        now,
        timelineSettings,
      );

      if (!shouldReject) continue;

      const autoRejectReason =
        "Tidak disetujui dalam batas waktu yang ditentukan";

      const result = await leaveService.rejectLeave(
        leave.id,
        "SYSTEM_AUTO",
        leave.tenantId!,
        autoRejectReason,
      );

      if (result.success) {
        await leaveRequestRepository.update(leave.id, {
          autoRejectedAt: now,
          autoRejectionReason: autoRejectReason,
        });
        rejectedIds.push(leave.id);
      }
    } catch (error) {
      logger.error(
        `[Cron Auto-Reject Leave] Failed to reject request ${leave.id}:`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  return {
    rejectedCount: rejectedIds.length,
    rejectedIds,
    checkedAt: now.toISOString(),
  };
}
