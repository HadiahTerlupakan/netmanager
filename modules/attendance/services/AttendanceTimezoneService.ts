import { logger } from "@/lib/logger";
/**
 * Attendance Timezone Service
 * Centralized timezone and tolerance management with caching
 * Reduces database queries for frequently accessed settings
 */

import { redis } from "@/lib/redis";
import { toZonedTime, toDate } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/constants/timezone-constants";
import {
  startOfDay as fnsStartOfDay,
  differenceInMinutes,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";

const TIMEZONE_CACHE_TTL_SECONDS = 3600;
const GENERAL_TIMEZONE_KEY = "GENERAL_TIMEZONE";
const GENERAL_ATTENDANCE_TOLERANCE_KEY = "GENERAL_ATTENDANCE_TOLERANCE";

export class AttendanceTimezoneService {
  private settingsRepo: ISettingsRepository;

  constructor(settingsRepo: ISettingsRepository = new SettingsRepository()) {
    this.settingsRepo = settingsRepo;
  }

  /**
   * Get system timezone setting with caching (1 hour TTL)
   * @param tenantId - Optional tenant ID
   * @returns Timezone string (e.g., 'Asia/Jakarta')
   */
  async getTimezone(tenantId?: string): Promise<string> {
    const cacheKey = this.buildCacheKey("timezone", tenantId);
    const cachedTimezone = await this.readCachedValue(cacheKey);
    if (cachedTimezone) return cachedTimezone;

    const setting = await this.settingsRepo.findByKey(
      GENERAL_TIMEZONE_KEY,
      tenantId,
    );
    const timezone = setting?.value || DEFAULT_TIMEZONE;
    await this.writeCachedValue(cacheKey, timezone);
    return timezone;
  }

  /**
   * Get attendance tolerance setting with caching (1 hour TTL)
   * @param tenantId - Optional tenant ID
   * @returns Tolerance in minutes
   */
  async getTolerance(tenantId?: string): Promise<number> {
    const cacheKey = this.buildCacheKey("tolerance", tenantId);
    const cachedTolerance = await this.readCachedValue(cacheKey);
    if (cachedTolerance) return parseInt(cachedTolerance, 10);

    const setting = await this.settingsRepo.findByKey(
      GENERAL_ATTENDANCE_TOLERANCE_KEY,
      tenantId,
    );
    const tolerance = setting?.value ? parseInt(setting.value, 10) : 0;
    await this.writeCachedValue(cacheKey, tolerance.toString());
    return tolerance;
  }

  /** Bangun key cache setting attendance per tenant. */
  private buildCacheKey(
    settingName: "timezone" | "tolerance",
    tenantId?: string,
  ): string {
    return `settings:${settingName}${tenantId ? `:${tenantId}` : ""}`;
  }

  /** Baca nilai cache Redis tanpa melempar error akses cache. */
  private async readCachedValue(cacheKey: string): Promise<string | null> {
    try {
      return await redis.get(cacheKey);
    } catch (error) {
      this.logCacheError("read", cacheKey, error);
      return null;
    }
  }

  /** Tulis nilai cache Redis tanpa memutus alur utama. */
  private async writeCachedValue(
    cacheKey: string,
    value: string,
  ): Promise<void> {
    try {
      await redis.setex(cacheKey, TIMEZONE_CACHE_TTL_SECONDS, value);
    } catch (error) {
      this.logCacheError("write", cacheKey, error);
    }
  }

  /** Catat kegagalan operasi cache timezone attendance. */
  private logCacheError(
    operation: "read" | "write",
    cacheKey: string,
    error: unknown,
  ): void {
    logger.error(
      `[AttendanceTimezoneService] Failed to ${operation} cache for ${cacheKey}:`,
      error,
    );
  }

  /**
   * Get effective date context for a given timezone
   * Returns the current time, start of day, and timezone offset
   *
   * @param timezone - Timezone string (e.g., 'Asia/Jakarta')
   * @returns Object with now, startOfDay, and tzOffsetMs
   */
  getEffectiveDate(timezone: string): {
    now: Date;
    startOfDay: Date;
    tzOffsetMs: number;
  } {
    const now = new Date();
    const zonedNow = toZonedTime(now, timezone);
    const localStartOfDay = fnsStartOfDay(zonedNow);
    const startOfDay = toDate(localStartOfDay, { timeZone: timezone });
    const tzOffsetMs = zonedNow.getTime() - now.getTime();

    return { now: zonedNow, startOfDay, tzOffsetMs };
  }

  /**
   * Calculate attendance status (ON_TIME or LATE) based on check-in time and schedule
   *
   * @param checkInTime - The actual check-in time
   * @param scheduleTime - The scheduled start time (e.g., '08:00')
   * @param timezone - Optional timezone (defaults to system timezone)
   * @param tenantId - Optional tenant ID for tenant-scoped tolerance
   * @returns 'ON_TIME' or 'LATE'
   */
  async calculateStatus(
    checkInTime: Date,
    scheduleTime: string,
    timezone?: string,
    tenantId?: string,
  ): Promise<"ON_TIME" | "LATE"> {
    const tz = timezone || (await this.getTimezone(tenantId));
    const toleranceMinutes = await this.getTolerance(tenantId);

    const scheduleParts = scheduleTime.split(":").map(Number);
    const schedHour = scheduleParts[0] ?? 0;
    const schedMinute = scheduleParts[1] ?? 0;

    const zonedCheckInTime = toZonedTime(checkInTime, tz);

    let zonedScheduleTime = fnsStartOfDay(zonedCheckInTime);
    zonedScheduleTime = setHours(zonedScheduleTime, schedHour);
    zonedScheduleTime = setMinutes(zonedScheduleTime, schedMinute);
    zonedScheduleTime = setSeconds(zonedScheduleTime, 0);
    zonedScheduleTime = setMilliseconds(zonedScheduleTime, 0);

    const scheduleUtcDate = toDate(zonedScheduleTime, { timeZone: tz });

    const diffMinutes = differenceInMinutes(checkInTime, scheduleUtcDate);

    return diffMinutes > toleranceMinutes ? "LATE" : "ON_TIME";
  }

  /**
   * Invalidate timezone and tolerance cache
   * Call this when settings are updated
   */
  async invalidateCache(tenantId?: string): Promise<void> {
    const keys = tenantId
      ? [`settings:timezone:${tenantId}`, `settings:tolerance:${tenantId}`]
      : ["settings:timezone", "settings:tolerance"];

    try {
      await redis.del(...keys);
    } catch (error) {
      logger.error(
        "[AttendanceTimezoneService] Failed to invalidate timezone cache:",
        error,
      );
      throw error;
    }
  }
}
