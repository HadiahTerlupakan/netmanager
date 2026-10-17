import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";
import type { AutoRejectSettings } from "./AutoRejectService";
import {
  ATTENDANCE_ACTIVITY_ACTIONS,
  ATTENDANCE_ACTIVITY_SUBJECTS,
  recordAttendanceActivity,
} from "./attendance-activity-log";

/** Service untuk mengelola tenant settings - wrapper untuk repository. */
export class TenantSettingsService {
  private repository: TenantSettingsRepository;

  constructor() {
    this.repository = new TenantSettingsRepository();
  }

  async getAutoRejectSettings(
    tenantId: string,
  ): Promise<AutoRejectSettings | null> {
    return this.repository.getAutoRejectSettings(tenantId);
  }

  /** Perbarui pengaturan auto-reject izin; catat pelakunya bila diketahui. */
  async updateAutoRejectSettings(
    tenantId: string,
    settings: Partial<AutoRejectSettings>,
    actorId?: string,
  ) {
    const updated = await this.repository.updateAutoRejectSettings(
      tenantId,
      settings,
    );
    if (actorId) {
      recordAttendanceActivity({
        action: ATTENDANCE_ACTIVITY_ACTIONS.UPDATE,
        subject: ATTENDANCE_ACTIVITY_SUBJECTS.ATTENDANCE_SETTINGS,
        reference: "Auto-Reject Izin",
        actor: { userId: actorId },
        tenantId,
        details: { perubahan: settings },
      });
    }
    return updated;
  }

  async createDefaultSettings(tenantId: string) {
    return this.repository.createDefaultSettings(tenantId);
  }

  async deleteSettings(tenantId: string) {
    return this.repository.deleteSettings(tenantId);
  }
}

export function getTenantSettingsService() {
  return new TenantSettingsService();
}
