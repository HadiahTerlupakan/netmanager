import type { HolidayEntity } from "../entities/HolidayEntity";

export interface IHolidayRepository {
  /** Check whether a date is configured as holiday. */
  isHoliday(
    date: Date,
    tenantId: string,
  ): Promise<{ isHoliday: boolean; holiday?: HolidayEntity | null }>;

  /** Find holiday on the requested day range. */
  findFirstByTenantAndDateRange(
    tenantId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<HolidayEntity | null>;
}
