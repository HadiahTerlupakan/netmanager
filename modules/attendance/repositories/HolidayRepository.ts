import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { redis } from "@/lib/redis";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";

import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import { toHolidayEntity } from "../mappers/AttendanceDomainMapper";

const HOLIDAY_CACHE_TTL_SECONDS = 86400;

type Holiday = Prisma.HolidayGetPayload<object>;

export class HolidayRepository implements IHolidayRepository {
  async create(
    data: Omit<Prisma.HolidayUncheckedCreateInput, "tenantId">,
    tenantId: string,
  ) {
    const holiday = await prisma.holiday.create({
      data: { ...data, tenantId },
    });
    // Invalidate holiday cache after creating new holiday
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
    // Invalidate holiday cache after updating
    await this.invalidateCache(tenantId);
    return holiday;
  }

  async delete(id: string, tenantId: string) {
    const holiday = await prisma.holiday.delete({
      where: { id, tenantId },
    });
    // Invalidate holiday cache after deleting
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
    const startOfDay = new Date(date);
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());

    const endOfDay = new Date(startOfDay);
    endOfDay.setTime(toEndOfDay(endOfDay).getTime());

    let cacheVersion = "0";
    try {
      const version = await redis.get(`holiday:${tenantId}:version`);
      if (version) cacheVersion = version;
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to read holiday cache version for tenant ${tenantId}:`,
        error,
      );
    }

    const cacheKey = `holiday:${tenantId}:v${cacheVersion}:${startOfDay.getTime()}`;

    try {
      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          isHoliday: boolean;
          holiday?: Holiday | null;
        };

        return {
          isHoliday: cached.isHoliday,
          holiday: cached.holiday ? toHolidayEntity(cached.holiday) : null,
        };
      }
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to read holiday cache for ${cacheKey}:`,
        error,
      );
    }

    const holiday = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        tenantId,
      },
    });

    const result = {
      isHoliday: !!holiday,
      holiday,
    };

    try {
      await redis.setex(
        cacheKey,
        HOLIDAY_CACHE_TTL_SECONDS,
        JSON.stringify(result),
      );
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to write holiday cache for ${cacheKey}:`,
        error,
      );
    }

    return {
      isHoliday: result.isHoliday,
      holiday: result.holiday ? toHolidayEntity(result.holiday) : null,
    };
  }

  async getHolidaysByYear(year: number, tenantId: string): Promise<Holiday[]> {
    let cacheVersion = "0";
    try {
      const version = await redis.get(`holiday:${tenantId}:version`);
      if (version) cacheVersion = version;
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to read holiday cache version for tenant ${tenantId}:`,
        error,
      );
    }

    const cacheKey = `holidays:${tenantId}:v${cacheVersion}:year:${year}`;

    try {
      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) return JSON.parse(cachedRaw) as Holiday[];
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to read holidays-by-year cache for ${cacheKey}:`,
        error,
      );
    }

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        tenantId,
      },
      orderBy: {
        date: "asc",
      },
    });

    try {
      await redis.setex(
        cacheKey,
        HOLIDAY_CACHE_TTL_SECONDS,
        JSON.stringify(holidays),
      );
    } catch (error) {
      logger.error(
        `[HolidayRepository] Failed to write holidays-by-year cache for ${cacheKey}:`,
        error,
      );
    }

    return holidays;
  }

  /**
   * Invalidate all holiday-related cache entries
   * Call this after creating, updating, or deleting holidays
   */
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

  /**
   * Find holiday for a tenant on a specific date range.
   * Used by AttendanceAlertService for auto-alpha processing.
   */
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
}
