import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { HolidayRepository } from "../repositories/HolidayRepository";

export class AdminHolidayRouteService {
  constructor(private readonly holidayRepository = new HolidayRepository()) {}

  /** Update holiday data for the current tenant. */
  async updateHoliday(
    id: string,
    tenantId: string,
    input: { date?: string; description?: string; isNational?: boolean },
  ) {
    const updateData: {
      date?: Date;
      description?: string;
      isNational?: boolean;
    } = {};
    if (input.date) updateData.date = new Date(input.date);
    if (input.description) updateData.description = input.description;
    if (input.isNational !== undefined)
      updateData.isNational = input.isNational;
    return this.holidayRepository.update(id, updateData, tenantId);
  }

  /** Delete holiday data for the current tenant. */
  async deleteHoliday(id: string, tenantId: string) {
    try {
      await this.holidayRepository.delete(id, tenantId);
      return { deleted: true };
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        return { deleted: false };
      }
      throw error;
    }
  }
}
