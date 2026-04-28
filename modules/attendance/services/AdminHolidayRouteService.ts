import { randomUUID } from "crypto";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { HolidayRepository } from "../repositories/HolidayRepository";

export interface HolidayCreateInput {
  date: string;
  description: string;
  isNational: boolean;
}

export interface HolidayUpdateInput {
  date?: string;
  description?: string;
  isNational?: boolean;
}

export class AdminHolidayRouteService {
  constructor(private readonly holidayRepository = new HolidayRepository()) {}

  /** Ambil daftar hari libur tenant berdasarkan tahun. */
  async getHolidaysByYear(year: number, tenantId: string) {
    return this.holidayRepository.getHolidaysByYear(year, tenantId);
  }

  /** Buat hari libur baru untuk tenant aktif. */
  async createHoliday(input: HolidayCreateInput, tenantId: string) {
    try {
      return await this.holidayRepository.create(
        {
          id: randomUUID(),
          date: new Date(input.date),
          description: input.description,
          isNational: input.isNational,
          updatedAt: new Date(),
        },
        tenantId,
      );
    } catch (error) {
      if (this.isDuplicateHolidayError(error)) {
        return null;
      }
      throw error;
    }
  }

  /** Update holiday data for the current tenant. */
  async updateHoliday(id: string, tenantId: string, input: HolidayUpdateInput) {
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

  /** Deteksi pelanggaran unique constraint tanggal libur. */
  private isDuplicateHolidayError(error: unknown) {
    return Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
    );
  }
}
