import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getTimezone } from "@/lib/utils/get-timezone";
import {
  buildListOpnameWhere,
  buildTanggalRange,
  computeOpnameHistoryStats,
  findLatestOpnameIds,
  findPagedOpnameRecords,
} from "@/modules/inventory/services/inventory-opname-list.helpers";
import { prismaMock } from "../../setup";

vi.mock("@/lib/auth", () => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/tenant-context", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTenantIdFromContext: vi.fn(),
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn(),
  getTimezoneSync: vi.fn(() => "Asia/Jakarta"),
}));

const JAKARTA = "Asia/Jakarta";
const USER = { id: "user-1", role: "ADMIN", siteId: null as string | null };

describe("buildTanggalRange", () => {
  it("memakai awal hari WIB untuk tanggal mulai dan awal hari berikutnya untuk tanggal selesai", () => {
    const range = buildTanggalRange(
      { tanggalMulai: "2026-11-01", tanggalSelesai: "2026-11-30" },
      JAKARTA,
    );

    expect(range?.gte?.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(range?.lt?.toISOString()).toBe("2026-11-30T17:00:00.000Z");
  });

  it("menangani pergantian bulan/tahun pada tanggal selesai", () => {
    const range = buildTanggalRange({ tanggalSelesai: "2026-12-31" }, JAKARTA);

    expect(range?.gte).toBeUndefined();
    expect(range?.lt?.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("mengabaikan tanggal yang bukan YYYY-MM-DD", () => {
    expect(
      buildTanggalRange(
        { tanggalMulai: "kemarin", tanggalSelesai: "" },
        JAKARTA,
      ),
    ).toBeNull();
  });
});

describe("buildListOpnameWhere", () => {
  beforeEach(() => {
    vi.mocked(getUserPermissions).mockResolvedValue([]);
    vi.mocked(isSuperAdmin).mockReturnValue(false);
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    vi.mocked(getTimezone).mockResolvedValue(JAKARTA);
  });

  it("membaca zona waktu tenant dari konteks untuk filter tanggal", async () => {
    const where = await buildListOpnameWhere({
      user: USER,
      tanggalMulai: "2026-11-23",
      tanggalSelesai: "2026-11-23",
      page: 1,
      limit: 20,
    });

    expect(getTimezone).toHaveBeenCalledWith("tenant-1");
    expect(where?.tanggal).toEqual({
      gte: new Date("2026-11-22T17:00:00.000Z"),
      lt: new Date("2026-11-23T17:00:00.000Z"),
    });
  });
});

describe("findPagedOpnameRecords", () => {
  it("mengurutkan tanggal lalu id agar pagination stabil dan menandai isTerbaru", async () => {
    prismaMock.stockOpname.findMany
      .mockResolvedValueOnce([
        { id: "op-3", barangId: "b1", gudangId: "g1" },
        { id: "op-2", barangId: "b1", gudangId: "g1" },
        { id: "op-1", barangId: "b2", gudangId: "g1" },
      ])
      .mockResolvedValueOnce([{ id: "op-3" }, { id: "op-1" }]);
    prismaMock.stockOpname.count.mockResolvedValueOnce(3);

    const result = await findPagedOpnameRecords({
      where: { gudangId: "g1" },
      page: 2,
      limit: 3,
    });

    const listArgs = prismaMock.stockOpname.findMany.mock.calls[0]?.[0];
    expect(listArgs.orderBy).toEqual([{ tanggal: "desc" }, { id: "desc" }]);
    expect(listArgs.skip).toBe(3);

    const latestArgs = prismaMock.stockOpname.findMany.mock.calls[1]?.[0];
    expect(latestArgs.where).toEqual({
      OR: [
        { barangId: "b1", gudangId: "g1" },
        { barangId: "b2", gudangId: "g1" },
      ],
    });
    expect(latestArgs.orderBy).toEqual([{ tanggal: "desc" }, { id: "desc" }]);
    expect(latestArgs.distinct).toEqual(["barangId", "gudangId"]);

    expect(result.opnameList.map((item) => [item.id, item.isTerbaru])).toEqual([
      ["op-3", true],
      ["op-2", false],
      ["op-1", true],
    ]);
  });

  it("tidak menjalankan query opname terakhir untuk halaman kosong", async () => {
    await expect(findLatestOpnameIds([])).resolves.toEqual(new Set());
    expect(prismaMock.stockOpname.findMany).not.toHaveBeenCalled();
  });
});

describe("computeOpnameHistoryStats", () => {
  it("menjumlah hilang hanya dari selisih negatif dan menghitung catatan perlu perhatian", async () => {
    const where = { gudangId: "g1" };
    prismaMock.stockOpname.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(4) // selisih nol
      .mockResolvedValueOnce(3); // perlu perhatian
    prismaMock.stockOpname.aggregate
      .mockResolvedValueOnce({
        _sum: { kondisiBaik: 50, kondisiRusak: 5, kondisiExpire: 1 },
      })
      .mockResolvedValueOnce({ _sum: { selisih: -7 } });

    const stats = await computeOpnameHistoryStats(where);

    const hilangArgs = prismaMock.stockOpname.aggregate.mock.calls[1]?.[0];
    expect(hilangArgs.where).toEqual({
      AND: [where, { alasanSelisih: "hilang", selisih: { lt: 0 } }],
    });
    expect(hilangArgs._sum).toEqual({ selisih: true });

    const perhatianArgs = prismaMock.stockOpname.count.mock.calls[2]?.[0];
    expect(perhatianArgs.where).toEqual({
      AND: [
        where,
        {
          OR: [
            { kondisiRusak: { gt: 0 } },
            { alasanSelisih: "hilang", selisih: { lt: 0 } },
          ],
        },
      ],
    });

    expect(stats).toMatchObject({
      totalRecords: 10,
      totalSelisihNol: 4,
      akurasiPercent: 40,
      totalKondisiRusak: 5,
      totalHilang: 7,
      totalPerluPerhatian: 3,
    });
  });

  it("menjawab nol bila tidak ada catatan hilang", async () => {
    prismaMock.stockOpname.count.mockResolvedValue(0);
    prismaMock.stockOpname.aggregate.mockResolvedValue({ _sum: {} });

    const stats = await computeOpnameHistoryStats({});

    expect(stats.totalHilang).toBe(0);
    expect(stats.akurasiPercent).toBe(100);
  });
});
