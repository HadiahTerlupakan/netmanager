import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { getLeaveService } from "./LeaveService";
import { LeaveTimelineService } from "./LeaveTimelineService";
import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";

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

  // Get all pending leave requests
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "PENDING",
    },
    select: {
      id: true,
      startDate: true,
      submittedAt: true,
      tenantId: true,
      firstReminderSentAt: true,
      secondReminderSentAt: true,
      finalReminderSentAt: true,
    },
  });

  const rejectedIds: string[] = [];

  for (const leave of pendingLeaves) {
    try {
      // Skip jika tenantId null
      if (!leave.tenantId) continue;

      // Get tenant settings
      const settings = await settingsRepository.getAutoRejectSettings(
        leave.tenantId,
      );
      if (!settings) continue;

      // Check timeline settings
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

      // Check if should auto-reject
      const shouldReject = timelineService.checkShouldAutoReject(
        leave.submittedAt,
        leave.startDate,
        now,
        timelineSettings,
      );

      if (!shouldReject) continue;

      // Reject leave
      const result = await leaveService.rejectLeave(
        leave.id,
        "SYSTEM_AUTO",
        leave.tenantId,
        "Tidak disetujui dalam batas waktu yang ditentukan",
      );

      if (result.success) {
        // Update auto-reject tracking fields
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: {
            autoRejectedAt: now,
            autoRejectionReason:
              "Tidak disetujui dalam batas waktu yang ditentukan",
          },
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
