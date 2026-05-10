import { prisma } from "@/modules/database";
import type { AutoRejectSettings } from "../services/AutoRejectService";

/** Repository untuk TenantSettings - auto-reject configuration. */
export class TenantSettingsRepository {
  /**
   * Get auto-reject settings untuk tenant.
   * Returns default settings jika belum ada di database.
   */
  async getAutoRejectSettings(
    tenantId: string,
  ): Promise<AutoRejectSettings | null> {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: {
        autoRejectInsufficientQuota: true,
        autoRejectBackdate: true,
        autoRejectOverlap: true,
        autoRejectTooLong: true,
        autoRejectSakitNoDocument: true,
        autoRejectCutiNoAdvance: true,
        autoRejectTukarLiburNoDate: true,
        autoRejectBlackoutPeriod: true,
        maxDaysPerRequest: true,
        minAdvanceNoticeDays: true,
        sakitDocumentRequiredDays: true,
        blackoutPeriods: true,
        enableTimelineAutoReject: true,
        mendadakDeadlineHours: true,
        mendadakReminder1Hours: true,
        mendadakReminder2Hours: true,
        normalDeadlineDays: true,
        normalReminder1Days: true,
        normalReminder2Days: true,
        advanceDeadlineDays: true,
        advanceReminder1Days: true,
        advanceReminder2Days: true,
        advanceReminder3Days: true,
      },
    });

    if (!settings) {
      return null;
    }

    return {
      ...settings,
      blackoutPeriods: settings.blackoutPeriods as Array<{
        start: string;
        end: string;
        reason: string;
      }>,
    };
  }

  /**
   * Update auto-reject settings untuk tenant.
   * Create jika belum ada, update jika sudah ada.
   */
  async updateAutoRejectSettings(
    tenantId: string,
    settings: Partial<AutoRejectSettings>,
  ) {
    return prisma.tenantSettings.upsert({
      where: { tenantId },
      update: settings,
      create: {
        tenantId,
        ...settings,
      },
    });
  }

  /**
   * Create default settings untuk tenant baru.
   */
  async createDefaultSettings(tenantId: string) {
    return prisma.tenantSettings.create({
      data: {
        tenantId,
        // Default values sudah di-set di schema.prisma
      },
    });
  }

  /**
   * Delete settings untuk tenant.
   */
  async deleteSettings(tenantId: string) {
    return prisma.tenantSettings.delete({
      where: { tenantId },
    });
  }
}
