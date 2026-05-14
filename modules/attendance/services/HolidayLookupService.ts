import { HolidayRepository } from "../repositories/HolidayRepository";

export class HolidayLookupService {
  constructor(private readonly repository = new HolidayRepository()) {}

  /** Check whether the given date is a holiday for a tenant. */
  isHoliday(date: Date, tenantId: string) {
    return this.repository.isHoliday(date, tenantId);
  }
}
