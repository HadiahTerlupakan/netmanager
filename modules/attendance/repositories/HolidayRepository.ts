import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { Prisma } from "@prisma/client";

import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import { toHolidayEntity } from "../mappers/AttendanceDomainMapper";

const HOLIDAY_CACHE_TTL_SECONDS = 86400;
const DEFAULT_CACHE_VERSION = "0";

type Holiday = Prisma.HolidayGetPayload<object>;
type CachedHolidayCheck = {
  isHoliday: boolean;
  holiday?: Holiday | null;
};

export class HolidayRepository implements IHolidayRepository {
  async create(
    data: Omit<Prisma.HolidayUncheckedCreateInput, "tenantId">,
    tenantId: string,
  ) {
    const holiday = await prisma.holiday.create({
      data: { ...data, tenantId },
    });
    await this.invalidateCache(tenantId);
    return holiday;
  }

  async update(
    id: string,
    data: Prisma.HolidayUncheckedUpdateInput,
    tenantId: string,
  ) {
    const holiday = await prisma.holiday.update({
      where: { id, tenantId },
      data,
    });
    await this.invalidateCache(tenantId);
    return holiday;
  }

  async delete(id: string, tenantId: string) {
    const holiday = await prisma.holiday.delete({
      where: { id, tenantId },
    });
    await this.invalidateCache(tenantId);
    return holiday;
  }

  async findMany(
    tenantId: string,
    params?: {
      where?: Prisma.HolidayWhereInput;
      orderBy?: Prisma.HolidayOrderByWithRelationInput;
    },
  ) {
    return prisma.holiday.findMany({
      ...params,
      where: {
        ...params?.where,
        tenantId,
      },
    });
  }

  /** Check whether a date is configured as a holiday. */
  async isHoliday(
    date: Date,
    tenantId: string,
  ): Promise<{
    isHoliday: boolean;
    holiday?: ReturnType<typeof toHolidayEntity> | null;
  }> {
    const { startOfDay, endOfDay } = this.createDayRange(date);
    const cacheKey = await this.buildDailyCacheKey(tenantId, startOfDay);
    const cached = await this.readCachedHolidayCheck(cacheKey);
    if (cached) return this.mapHolidayCheck(cached);

    const holiday = await prisma.holiday.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        tenantId,
      },
    });
    const result = { isHoliday: Boolean(holiday), holiday };

    await this.writeCacheSafely(cacheKey, result, "holiday cache");
    return this.mapHolidayCheck(result);
  }

  /** Get all holidays in a year with tenant cache support. */
  async getHolidaysByYear(year: number, tenantId: string): Promise<Holiday[]> {
    const cacheKey = await this.buildYearlyCacheKey(tenantId, year);
    const cached = await this.readCachedYearlyHolidays(cacheKey);
    if (cached) return cached;

    const holidays = await prisma.holiday.findMany({
      where: {
        date: this.createYearDateRange(year),
        tenantId,
      },
      orderBy: { date: "asc" },
    });

    await this.writeCacheSafely(cacheKey, holidays, "holidays-by-year cache");
    return holidays;
  }

  /** Invalidate all holiday-related cache entries. */
  async invalidateCache(tenantId: string): Promise<void> {
    try {
      await redis.incr(`holiday:${tenantId}:version`);
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to invalidate holiday cache for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  /** Find holiday for a tenant within a day range. */
  async findFirstByTenantAndDateRange(
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const holiday = await prisma.holiday.findFirst({
      where: {
        tenantId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return holiday ? toHolidayEntity(holiday) : null;
  }

  private createDayRange(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());

    const endOfDay = new Date(startOfDay);
    endOfDay.setTime(toEndOfDay(endOfDay).getTime());

    return { startOfDay, endOfDay };
  }

  private createYearDateRange(year: number) {
    return {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59),
    };
  }

  private async buildDailyCacheKey(tenantId: string, startOfDay: Date) {
    const cacheVersion = await this.getCacheVersion(tenantId);
    return `holiday:${tenantId}:v${cacheVersion}:${startOfDay.getTime()}`;
  }

  private async buildYearlyCacheKey(tenantId: string, year: number) {
    const cacheVersion = await this.getCacheVersion(tenantId);
    return `holidays:${tenantId}:v${cacheVersion}:year:${year}`;
  }

  private async getCacheVersion(tenantId: string) {
    try {
      return (
        (await redis.get(`holiday:${tenantId}:version`)) ??
        DEFAULT_CACHE_VERSION
      );
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to read holiday cache version for tenant ${tenantId}:`,
        error,
      );
      return DEFAULT_CACHE_VERSION;
    }
  }

  private async readCachedHolidayCheck(cacheKey: string) {
    return this.readCacheSafely<CachedHolidayCheck>(cacheKey, "holiday cache");
  }

  private async readCachedYearlyHolidays(cacheKey: string) {
    return this.readCacheSafely<Holiday[]>(cacheKey, "holidays-by-year cache");
  }

  private async readCacheSafely<T>(cacheKey: string, label: string) {
    try {
      const cachedRaw = await redis.get(cacheKey);
      return cachedRaw ? (JSON.parse(cachedRaw) as T) : null;
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to read ${label} for ${cacheKey}:`,
        error,
      );
      return null;
    }
  }

  private async writeCacheSafely(
    cacheKey: string,
    value: unknown,
    label: string,
  ) {
    try {
      await redis.setex(
        cacheKey,
        HOLIDAY_CACHE_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to write ${label} for ${cacheKey}:`,
        error,
      );
    }
  }

  private mapHolidayCheck(result: CachedHolidayCheck) {
    return {
      isHoliday: result.isHoliday,
      holiday: result.holiday ? toHolidayEntity(result.holiday) : null,
    };
  }
}
