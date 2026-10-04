import { HolidayRepository } from "../repositories/HolidayRepository";

export class HolidayLookupService {
  constructor(private readonly repository = new HolidayRepository()) {}

  /** Check whether the given date is a holiday for a tenant. */
  isHoliday(date: Date, tenantId: string) {
    return this.repository.isHoliday(date, tenantId);
  }

  /** Semua tanggal libur tenant pada tahun-tahun tersebut, terurut. */
  async listHolidayDates(years: number[], tenantId: string): Promise<Date[]> {
    const perYear = await Promise.all(
      years.map((year) => this.repository.getHolidaysByYear(year, tenantId)),
    );
    // Cache Redis menyimpan JSON, jadi tanggal bisa kembali sebagai string.
    return perYear.flat().map((holiday) => new Date(holiday.date));
  }
}
