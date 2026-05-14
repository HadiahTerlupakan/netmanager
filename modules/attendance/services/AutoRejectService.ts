import { startOfDay, isBefore, differenceInDays } from "date-fns";
import type { LeaveType } from "../types/attendance.enums";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";

export interface AutoRejectInput {
  userId: string;
  tenantId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  leaveDays: number;
  hasAttachment: boolean;
  replacementDate?: Date;
  isAdminCreated?: boolean;
}

export interface AutoRejectResult {
  autoReject: boolean;
  reason: string;
}

export interface AutoRejectSettings {
  autoRejectInsufficientQuota: boolean;
  autoRejectBackdate: boolean;
  autoRejectOverlap: boolean;
  autoRejectTooLong: boolean;
  autoRejectSakitNoDocument: boolean;
  autoRejectCutiNoAdvance: boolean;
  autoRejectTukarLiburNoDate: boolean;
  autoRejectBlackoutPeriod: boolean;
  maxDaysPerRequest: number;
  minAdvanceNoticeDays: number;
  sakitDocumentRequiredDays: number;
  blackoutPeriods: Array<{ start: string; end: string; reason: string }>;
  // Timeline-based auto-reject settings
  enableTimelineAutoReject: boolean;
  mendadakDeadlineHours: number;
  mendadakReminder1Hours: number;
  mendadakReminder2Hours: number;
  normalDeadlineDays: number;
  normalReminder1Days: number;
  normalReminder2Days: number;
  advanceDeadlineDays: number;
  advanceReminder1Days: number;
  advanceReminder2Days: number;
  advanceReminder3Days: number;
}

export const DEFAULT_AUTO_REJECT_SETTINGS: AutoRejectSettings = {
  autoRejectInsufficientQuota: true,
  autoRejectBackdate: true,
  autoRejectOverlap: true,
  autoRejectTooLong: true,
  autoRejectSakitNoDocument: true,
  autoRejectCutiNoAdvance: true,
  autoRejectTukarLiburNoDate: true,
  autoRejectBlackoutPeriod: true,
  maxDaysPerRequest: 14,
  minAdvanceNoticeDays: 3,
  sakitDocumentRequiredDays: 2,
  blackoutPeriods: [],
  enableTimelineAutoReject: true,
  mendadakDeadlineHours: 8,
  mendadakReminder1Hours: 4,
  mendadakReminder2Hours: 6,
  normalDeadlineDays: 1,
  normalReminder1Days: 3,
  normalReminder2Days: 2,
  advanceDeadlineDays: 1,
  advanceReminder1Days: 7,
  advanceReminder2Days: 3,
  advanceReminder3Days: 1,
};

/** Service untuk validasi auto-reject leave request. */
export class AutoRejectService {
  constructor(
    private readonly leaveRepository: ILeaveRepository = new LeaveRepository(),
    private readonly leaveBalanceRepository: ILeaveBalanceRepository = new LeaveBalanceRepository(),
    private readonly settingsRepository: TenantSettingsRepository = new TenantSettingsRepository(),
  ) {}

  /**
   * Check apakah leave request harus auto-reject berdasarkan 8 validation rules.
   * Returns { autoReject: true, reason: string } jika harus reject.
   * Returns { autoReject: false, reason: "" } jika pass validation.
   */
  async shouldAutoReject(input: AutoRejectInput): Promise<AutoRejectResult> {
    // Get settings dari database, fallback ke default
    const settings = await this.settingsRepository.getAutoRejectSettings(
      input.tenantId,
    );
    const effectiveSettings = settings || DEFAULT_AUTO_REJECT_SETTINGS;

    // Admin-created leaves bypass some rules
    if (input.isAdminCreated) {
      return this.validateAdminCreatedLeave(input, effectiveSettings);
    }

    // Rule 1: Quota tidak cukup
    if (effectiveSettings.autoRejectInsufficientQuota) {
      const quotaCheck = await this.checkQuota(input);
      if (quotaCheck.autoReject) return quotaCheck;
    }

    // Rule 2: Backdate
    if (effectiveSettings.autoRejectBackdate) {
      const backdateCheck = this.checkBackdate(input);
      if (backdateCheck.autoReject) return backdateCheck;
    }

    // Rule 3: Overlap
    if (effectiveSettings.autoRejectOverlap) {
      const overlapCheck = await this.checkOverlap(input);
      if (overlapCheck.autoReject) return overlapCheck;
    }

    // Rule 4: Durasi terlalu panjang
    if (effectiveSettings.autoRejectTooLong) {
      const durationCheck = this.checkDuration(input, effectiveSettings);
      if (durationCheck.autoReject) return durationCheck;
    }

    // Rule 5: Sakit tanpa dokumen
    if (effectiveSettings.autoRejectSakitNoDocument) {
      const sakitDocCheck = this.checkSakitDocument(input, effectiveSettings);
      if (sakitDocCheck.autoReject) return sakitDocCheck;
    }

    // Rule 6: Cuti tanpa advance notice
    if (effectiveSettings.autoRejectCutiNoAdvance) {
      const advanceCheck = this.checkAdvanceNotice(input, effectiveSettings);
      if (advanceCheck.autoReject) return advanceCheck;
    }

    // Rule 7: Tukar libur tanpa tanggal pengganti
    if (effectiveSettings.autoRejectTukarLiburNoDate) {
      const tukarLiburCheck = this.checkTukarLibur(input);
      if (tukarLiburCheck.autoReject) return tukarLiburCheck;
    }

    // Rule 8: Blackout period
    if (effectiveSettings.autoRejectBlackoutPeriod) {
      const blackoutCheck = this.checkBlackoutPeriod(input, effectiveSettings);
      if (blackoutCheck.autoReject) return blackoutCheck;
    }

    return { autoReject: false, reason: "" };
  }

  /** Admin bypass backdate, tapi tetap check quota & overlap. */
  private async validateAdminCreatedLeave(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): Promise<AutoRejectResult> {
    if (settings.autoRejectInsufficientQuota) {
      const quotaCheck = await this.checkQuota(input);
      if (quotaCheck.autoReject) return quotaCheck;
    }

    if (settings.autoRejectOverlap) {
      const overlapCheck = await this.checkOverlap(input);
      if (overlapCheck.autoReject) return overlapCheck;
    }

    return { autoReject: false, reason: "" };
  }

  /** Rule 1: Check quota tidak cukup. */
  private async checkQuota(input: AutoRejectInput): Promise<AutoRejectResult> {
    // Skip quota check untuk TUKAR_LIBUR
    if (input.leaveType === "TUKAR_LIBUR") {
      return { autoReject: false, reason: "" };
    }

    const currentYear = input.startDate.getFullYear();
    const remainingDays = await this.leaveBalanceRepository.getRemainingDays(
      input.userId,
      currentYear,
      input.leaveType,
      input.tenantId,
    );

    if (remainingDays < input.leaveDays) {
      return {
        autoReject: true,
        reason: `Quota ${input.leaveType} tidak cukup. Sisa: ${remainingDays} hari, diminta: ${input.leaveDays} hari`,
      };
    }

    return { autoReject: false, reason: "" };
  }

  /** Rule 2: Check backdate (tanggal sudah lewat). */
  private checkBackdate(input: AutoRejectInput): AutoRejectResult {
    const today = startOfDay(new Date());
    if (isBefore(input.startDate, today)) {
      return {
        autoReject: true,
        reason: "Tidak bisa mengajukan izin untuk tanggal yang sudah lewat",
      };
    }
    return { autoReject: false, reason: "" };
  }

  /** Rule 3: Check overlap dengan leave lain yang sudah APPROVED. */
  private async checkOverlap(
    input: AutoRejectInput,
  ): Promise<AutoRejectResult> {
    const existingLeave =
      await this.leaveRepository.findActiveLeaveForUserOnDate(
        input.userId,
        input.startDate,
        input.endDate,
        input.tenantId,
      );

    if (existingLeave) {
      return {
        autoReject: true,
        reason: `Anda sudah memiliki ${existingLeave.type} yang disetujui pada tanggal ini`,
      };
    }

    return { autoReject: false, reason: "" };
  }

  /** Rule 4: Check durasi terlalu panjang. */
  private checkDuration(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    if (input.leaveDays > settings.maxDaysPerRequest) {
      return {
        autoReject: true,
        reason: `Durasi izin maksimal ${settings.maxDaysPerRequest} hari per pengajuan. Silakan pecah menjadi beberapa pengajuan.`,
      };
    }
    return { autoReject: false, reason: "" };
  }

  /** Rule 5: Check sakit > 2 hari tanpa dokumen. */
  private checkSakitDocument(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    if (
      input.leaveType === "SAKIT" &&
      input.leaveDays > settings.sakitDocumentRequiredDays &&
      !input.hasAttachment
    ) {
      return {
        autoReject: true,
        reason: `Sakit lebih dari ${settings.sakitDocumentRequiredDays} hari wajib melampirkan surat dokter`,
      };
    }
    return { autoReject: false, reason: "" };
  }

  /** Rule 6: Check cuti tanpa advance notice. */
  private checkAdvanceNotice(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    if (input.leaveType !== "CUTI") {
      return { autoReject: false, reason: "" };
    }

    const daysInAdvance = differenceInDays(input.startDate, new Date());
    if (daysInAdvance < settings.minAdvanceNoticeDays) {
      return {
        autoReject: true,
        reason: `Cuti harus diajukan minimal ${settings.minAdvanceNoticeDays} hari sebelumnya. Anda mengajukan ${daysInAdvance} hari sebelumnya.`,
      };
    }

    return { autoReject: false, reason: "" };
  }

  /** Rule 7: Check tukar libur tanpa tanggal pengganti. */
  private checkTukarLibur(input: AutoRejectInput): AutoRejectResult {
    if (input.leaveType === "TUKAR_LIBUR" && !input.replacementDate) {
      return {
        autoReject: true,
        reason: "Tukar libur harus menyertakan tanggal pengganti",
      };
    }
    return { autoReject: false, reason: "" };
  }

  /** Rule 8: Check blackout period. */
  private checkBlackoutPeriod(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    for (const period of settings.blackoutPeriods) {
      const periodStart = new Date(period.start);
      const periodEnd = new Date(period.end);

      // Check if leave overlaps with blackout period
      if (input.startDate <= periodEnd && input.endDate >= periodStart) {
        return {
          autoReject: true,
          reason: `Tidak bisa mengajukan cuti pada periode sibuk: ${period.reason}`,
        };
      }
    }

    return { autoReject: false, reason: "" };
  }
}
