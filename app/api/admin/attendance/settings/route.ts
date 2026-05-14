import { createHandler } from "@/lib/api";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getTenantSettingsService } from "@/modules/attendance";
import { hasPermission } from "@/lib/rbac";

const DEFAULT_SETTINGS = {
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
  blackoutPeriods: [] as string[],
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

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("attendance:update"))) {
    return ApiErrors.forbidden("Tidak memiliki akses ke pengaturan kehadiran");
  }

  const tenantId = ctx.session.user.tenantId;
  if (!tenantId) return ApiErrors.unauthorized("Tenant tidak ditemukan");

  const settingsService = getTenantSettingsService();
  const settings = await settingsService.getAutoRejectSettings(tenantId);

  return apiSuccess(settings || DEFAULT_SETTINGS);
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("attendance:update"))) {
    return ApiErrors.forbidden("Tidak memiliki akses ke pengaturan kehadiran");
  }

  const tenantId = ctx.session.user.tenantId;
  if (!tenantId) return ApiErrors.unauthorized("Tenant tidak ditemukan");

  const body = await req.json();
  const settingsService = getTenantSettingsService();
  const updatedSettings = await settingsService.updateAutoRejectSettings(
    tenantId,
    body,
  );

  return apiSuccess(updatedSettings);
});
