import { describe, expect, it } from "vitest";

import { buildReportedOvertimeWhere } from "@/modules/overtime/repositories/OvertimeRepository.helpers";

/**
 * Laporan lembur dulu menghitung semua pengajuan (termasuk menunggu/ditolak)
 * berdasarkan `createdAt`. Kini sama dengan penggajian: sesi COMPLETED
 * berdasarkan `startTime`.
 */
describe("buildReportedOvertimeWhere", () => {
  const range = {
    startDate: new Date("2026-10-31T17:00:00Z"),
    endDate: new Date("2026-11-30T16:59:59Z"),
  };

  it("hanya sesi selesai, berdasarkan waktu mulai lembur", () => {
    expect(buildReportedOvertimeWhere(range)).toEqual({
      status: "COMPLETED",
      startTime: { gte: range.startDate, lte: range.endDate },
    });
  });

  it("membawa tenant dan lingkup site/departemen pegawai", () => {
    const where = buildReportedOvertimeWhere({
      ...range,
      tenantId: "t1",
      siteId: { in: ["s1", "s2"] },
      departmentId: "d1",
    });
    expect(where).toMatchObject({
      tenantId: "t1",
      user: { siteId: { in: ["s1", "s2"] }, departmentId: "d1" },
    });
  });
});
