import type { SalaryWithDetailsEntity } from "../domain/entities/SalaryEntity";
import type {
  ISalaryRepository,
  SalaryFilters,
} from "../domain/ports/ISalaryRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import type { SalaryListResult, ServiceResult } from "./SalaryService.helpers";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

/** Mengelola query salary list, detail, dan period stats. */
export class SalaryQueryService {
  constructor(
    private readonly repository: ISalaryRepository = new SalaryRepository(),
  ) {}

  /** Ambil daftar salary dengan filter dan pagination. */
  async getSalaries(
    filters: SalaryFilters,
    page: number = DEFAULT_PAGE,
    limit: number = DEFAULT_LIMIT,
  ): Promise<ServiceResult<SalaryListResult>> {
    const skip = (page - 1) * limit;
    const result = await this.repository.findAll({
      ...filters,
      skip,
      take: limit,
    });
    const stats = await this.getPeriodStats(filters);

    return {
      success: true,
      data: {
        salaries: result.salaries,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
        stats,
      },
    };
  }

  /** Ambil detail salary berdasarkan ID. */
  async getSalaryById(
    id: string,
  ): Promise<ServiceResult<SalaryWithDetailsEntity>> {
    const salary = await this.repository.findById(id);
    if (!salary) {
      return {
        success: false,
        error: "Gaji tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    return { success: true, data: salary };
  }

  private async getPeriodStats(filters: SalaryFilters) {
    if (!filters.month || !filters.year) {
      return undefined;
    }

    return this.repository.getPeriodStats(filters.month, filters.year);
  }
}
