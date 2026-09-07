import { logger } from "@/lib/logger";
import { LeaveTimelineService } from "./LeaveTimelineService";
import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";
import { LeaveRequestRepository } from "../repositories/LeaveRequestRepository";
import { createNotification } from "@/modules/notification";

export interface ReminderCronResult {
  sentCount: number;
  sentIds: string[];
  checkedAt: string;
}

/** Cron service untuk mengirim reminder ke approver sebelum deadline auto-reject. */
export async function sendLeaveReminders(
  now = new Date(),
): Promise<ReminderCronResult> {
  const timelineService = new LeaveTimelineService();
  const settingsRepository = new TenantSettingsRepository();
  const leaveRequestRepository = new LeaveRequestRepository();

  const pendingLeaves = await leaveRequestRepository.findPendingForReminder();

  const sentIds: string[] = [];

  // Cache per-tenant untuk menghindari N+1 query
  const settingsCache = new Map<
    string,
    Awaited<ReturnType<typeof settingsRepository.getAutoRejectSettings>>
  >();
  const approversCache = new Map<string, string[]>();

  for (const leave of pendingLeaves) {
    try {
      // Skip jika tenantId null
      if (!leave.tenantId) continue;

      // Get tenant settings — gunakan cache agar tidak fetch ulang per leave
      if (!settingsCache.has(leave.tenantId)) {
        settingsCache.set(
          leave.tenantId,
          await settingsRepository.getAutoRejectSettings(leave.tenantId),
        );
      }
      const settings = settingsCache.get(leave.tenantId);
      if (!settings || !settings.enableTimelineAutoReject) continue;

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

      // Determine which reminder stage to send
      const stage = timelineService.determineReminderStage(
        leave.submittedAt,
        leave.startDate,
        now,
        leave.firstReminderSentAt,
        leave.secondReminderSentAt,
        leave.finalReminderSentAt,
        timelineSettings,
      );

      if (!stage) continue;

      // Get approvers — gunakan cache agar tidak fetch ulang per leave
      if (!approversCache.has(leave.tenantId)) {
        approversCache.set(
          leave.tenantId,
          await leaveRequestRepository.findApproverIds(leave.tenantId),
        );
      }
      const approvers = approversCache.get(leave.tenantId)!;

      if (approvers.length === 0) continue;

      // Determine category for message
      const category = timelineService.determineCategory(
        leave.submittedAt,
        leave.startDate,
      );
      const deadline = timelineService.calculateDeadline(
        category,
        leave.submittedAt,
        leave.startDate,
        timelineSettings,
      );

      // Send notification to all approvers
      const message = buildReminderMessage(
        leave.user.name,
        leave.type,
        stage,
        deadline,
      );

      for (const approverId of approvers) {
        await createNotification({
          userId: approverId,
          tenantId: leave.tenantId,
          title: "Reminder: Persetujuan Izin Pending",
          message,
          type: "SYSTEM",
          link: "/admin/kehadiran/izin",
        });
      }

      // Update reminder tracking field
      const updateData: Record<string, Date> = {};
      if (stage === "first") {
        updateData.firstReminderSentAt = now;
      } else if (stage === "second") {
        updateData.secondReminderSentAt = now;
      } else if (stage === "final") {
        updateData.finalReminderSentAt = now;
      }

      await leaveRequestRepository.update(leave.id, updateData);

      sentIds.push(leave.id);
    } catch (error) {
      logger.error(
        `[Cron Reminder] Failed to send reminder for request ${leave.id}:`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  return {
    sentCount: sentIds.length,
    sentIds,
    checkedAt: now.toISOString(),
  };
}

/** Build reminder message based on stage and deadline. */
function buildReminderMessage(
  userName: string,
  leaveType: string,
  stage: "first" | "second" | "final",
  deadline: Date,
): string {
  const deadlineStr = deadline.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const urgencyMap = {
    first: "Pengingat",
    second: "Pengingat Kedua",
    final: "Pengingat Terakhir",
  };

  return `${urgencyMap[stage]}: Permohonan ${leaveType} dari ${userName} masih menunggu persetujuan. Deadline: ${deadlineStr}. Jika tidak disetujui sebelum deadline, akan otomatis ditolak.`;
}
