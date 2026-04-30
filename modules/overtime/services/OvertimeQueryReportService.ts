import type { OvertimeQueryFilters } from "../domain/ports/IOvertimeRepository";
import type { IOvertimeRepository } from "../domain/ports/IOvertimeRepository";
import { OvertimeMapper } from "../mappers/OvertimeMapper";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import { buildReportSummary } from "./OvertimeService.helpers";
import { OvertimeAttendanceStateService } from "./OvertimeAttendanceStateService";

/** Mengelola query list, detail, update ringan, dan report overtime. */
export class OvertimeQueryReportService {
  constructor(
    private readonly repository: IOvertimeRepository = new OvertimeRepository(),
    private readonly attendanceStateService = new OvertimeAttendanceStateService(),
  ) {}

  /** Ambil history overtime untuk satu user. */
  async getHistory(userId: string, tenantId?: string) {
    return this.repository.findAll({ userId, tenantId });
  }

  /** Ambil semua request overtime untuk admin listing. */
  async getAllRequests(filters?: OvertimeQueryFilters) {
    const [data, total, summary] = await Promise.all([
      this.repository.findAll(filters),
      this.repository.count(filters),
      this.repository.countByStatus(filters),
    ]);
    const enrichedData = await this.attendanceStateService.enrichOvertimeFlags(
      data,
      filters?.tenantId,
    );

    return {
      data: OvertimeMapper.toListItemDTOs(enrichedData),
      total,
      summary,
    };
  }

  /** Ambil satu overtime berdasarkan ID. */
  async getOvertimeById(id: string, tenantId?: string) {
    return this.repository.findById(id, tenantId);
  }

  /** Update field overtime dari admin route. */
  async updateOvertime(
    id: string,
    data: { reason?: string; startTime?: Date; endTime?: Date },
  ) {
    return this.repository.update(id, data);
  }

  /** Ambil agregasi report overtime. */
  async getReportData(input: OvertimeReportInput) {
    const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees] =
      await Promise.all([
        this.repository.getStatsByDateRange(
          input.startDate,
          input.endDate,
          input.siteId,
          input.departmentId,
        ),
        this.repository.getDailyStats(
          input.startDate,
          input.endDate,
          input.siteId,
          input.departmentId,
        ),
        this.repository.getGroupedStats(input.startDate, input.endDate, "site"),
        this.repository.getGroupedStats(
          input.startDate,
          input.endDate,
          "department",
        ),
        this.repository.getTopEmployees(
          input.startDate,
          input.endDate,
          5,
          input.siteId,
          input.departmentId,
        ),
      ]);

    return {
      summary: buildReportSummary(stats.totalRequests, stats.totalDuration),
      trends: dailyStats,
      bySite: groupedBySite,
      byDepartment: groupedByDept,
      topEmployees,
    };
  }
}

type OvertimeReportInput = {
  startDate: Date;
  endDate: Date;
  siteId?: string;
  departmentId?: string;
};
