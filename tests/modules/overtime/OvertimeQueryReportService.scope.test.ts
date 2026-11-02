import { describe, expect, it, vi } from "vitest";

import { OvertimeQueryReportService } from "@/modules/overtime/services/OvertimeQueryReportService";

// Regresi: grafik lembur per site/departemen dihitung tanpa lingkup, sehingga
// admin ber-site_only melihat angka seluruh site di laporan kehadiran.
describe("OvertimeQueryReportService.getReportData — lingkup", () => {
  it("meneruskan site/departemen ke agregasi terkelompok", async () => {
    const repository = {
      getStatsByDateRange: vi
        .fn()
        .mockResolvedValue({ totalRequests: 0, totalDuration: 0 }),
      getDailyStats: vi.fn().mockResolvedValue([]),
      getGroupedStats: vi.fn().mockResolvedValue([]),
      getTopEmployees: vi.fn().mockResolvedValue([]),
    };
    const service = new OvertimeQueryReportService(
      repository as never,
      {} as never,
    );
    const startDate = new Date("2026-03-01");
    const endDate = new Date("2026-03-31");

    await service.getReportData({
      startDate,
      endDate,
      siteId: "site-1",
      departmentId: "dept-1",
    });

    expect(repository.getGroupedStats).toHaveBeenCalledWith(
      startDate,
      endDate,
      "site",
      "site-1",
      "dept-1",
    );
    expect(repository.getGroupedStats).toHaveBeenCalledWith(
      startDate,
      endDate,
      "department",
      "site-1",
      "dept-1",
    );
  });
});
