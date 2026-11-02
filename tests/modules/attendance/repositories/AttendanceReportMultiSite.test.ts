import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prisma } from "@/lib/prisma";
import { AttendanceReportRankingRepository } from "@/modules/attendance/repositories/AttendanceReportRankingRepository";
import { AttendanceReportSummaryRepository } from "@/modules/attendance/repositories/AttendanceReportSummaryRepository";
import { AttendanceUserReportRepository } from "@/modules/attendance/repositories/AttendanceUserReportRepository";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(async () => ({
    tenantId: "tenant-1",
    isSuperAdmin: false,
  })),
}));

/**
 * Regresi multi-site laporan kehadiran: repository laporan dulu hanya
 * menerima satu `siteId` (site utama admin). Filter `{ in }` lingkup admin
 * harus sampai utuh ke klausa Prisma kolom `siteId` pegawai.
 */
const START = new Date("2026-10-01T00:00:00.000Z");
const END = new Date("2026-10-31T23:59:59.999Z");
const MULTI_SITE = { in: ["site-a", "site-b"] };

/** `vi.mocked` pada `groupBy` Prisma memicu galat tipe sirkular (TS2615). */
const attendanceGroupByMock = (): Mock =>
  prisma.attendance.groupBy as unknown as Mock;

function userFindManyWhere(callIndex = 0) {
  return vi.mocked(prisma.user.findMany).mock.calls[callIndex]?.[0]?.where;
}

describe("laporan kehadiran — filter multi-site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    attendanceGroupByMock().mockResolvedValue([]);
  });

  it("peringkat hadir menyaring pegawai ke seluruh site lingkup", async () => {
    const result =
      await new AttendanceReportRankingRepository().getTopEmployees(
        START,
        END,
        5,
        MULTI_SITE,
      );

    expect(userFindManyWhere()).toMatchObject({ siteId: MULTI_SITE });
    expect(result).toEqual([]);
    expect(prisma.attendance.groupBy).not.toHaveBeenCalled();
  });

  it("peringkat alpha menyaring pegawai fixed-hour ke seluruh site lingkup", async () => {
    await new AttendanceReportRankingRepository().getTopAbsentees(
      START,
      END,
      5,
      MULTI_SITE,
    );

    expect(userFindManyWhere()).toMatchObject({
      siteId: MULTI_SITE,
      workingHourMode: { not: "FLEXIBLE" },
    });
  });

  it("grafik per site/departemen membatasi pegawai ke seluruh site lingkup", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { userId: "u1", present: 1, late: 0, total: 1 },
    ] as never);

    await new AttendanceReportRankingRepository().getGroupedStats(
      START,
      END,
      "site",
      undefined,
      { siteId: MULTI_SITE },
    );

    expect(userFindManyWhere()).toMatchObject({
      id: { in: ["u1"] },
      siteId: MULTI_SITE,
    });
  });

  it("ringkasan status memakai seluruh site lingkup dan kosong bila tak ada pegawai", async () => {
    const result =
      await new AttendanceReportSummaryRepository().getStatsByDateRange(
        START,
        END,
        MULTI_SITE,
      );

    expect(userFindManyWhere()).toEqual({ siteId: MULTI_SITE });
    expect(result.total).toBe(0);
    expect(prisma.attendance.count).not.toHaveBeenCalled();
  });

  it("statistik per pegawai memakai seluruh site lingkup", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }] as never);

    await new AttendanceUserReportRepository().getUserLateStats(
      START,
      END,
      MULTI_SITE,
    );

    expect(userFindManyWhere()).toEqual({ siteId: MULTI_SITE });
    const groupByCalls = attendanceGroupByMock().mock.calls as unknown as Array<
      [{ where: unknown }]
    >;
    expect(groupByCalls[0]?.[0].where).toMatchObject({
      userId: { in: ["u1"] },
    });
  });

  it("satu site tetap diteruskan sebagai string", async () => {
    await new AttendanceReportRankingRepository().getTopEmployees(
      START,
      END,
      5,
      "site-a",
    );

    expect(userFindManyWhere()).toMatchObject({ siteId: "site-a" });
  });
});
