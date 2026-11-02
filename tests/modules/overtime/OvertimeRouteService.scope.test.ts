import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserPermissions: mocks.getUserPermissions,
}));

// Index attendance berat; cukup resolver aslinya.
vi.mock("@/modules/attendance", async () =>
  vi.importActual("@/modules/attendance/services/AdminScopeResolver"),
);

import { OvertimeRouteService } from "@/modules/overtime/services/OvertimeRouteService";

const SESSION = {
  user: { id: "admin-1", role: "ADMIN", tenantId: "t1" },
} as never;

function buildService(currentUser: {
  siteId: string | null;
  departmentId: string | null;
}) {
  const overtimeService = {
    findAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    countByStatus: vi.fn().mockResolvedValue({}),
    enrichOvertimeFlags: vi.fn().mockResolvedValue([]),
    getOvertimeById: vi.fn().mockResolvedValue({
      id: "ot-1",
      user: { siteId: "site-a", departmentId: "dep-a" },
    }),
    approveRequest: vi.fn().mockResolvedValue({}),
    deleteOvertime: vi.fn(),
  };
  const userLookup = { findById: vi.fn().mockResolvedValue(currentUser) };
  const service = new OvertimeRouteService(
    overtimeService as never,
    userLookup as never,
  );
  return { service, overtimeService };
}

describe("OvertimeRouteService — lingkup site/departemen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin lembur:site_only tanpa site mendapat daftar kosong, bukan seluruh tenant", async () => {
    mocks.getUserPermissions.mockResolvedValue([
      "lembur:read",
      "lembur:site_only",
    ]);
    const { service, overtimeService } = buildService({
      siteId: null,
      departmentId: null,
    });

    const result = await service.getAdminList({
      session: SESSION,
      page: 1,
      limit: 10,
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(overtimeService.findAll).not.toHaveBeenCalled();
  });

  it("admin lembur:department_only tanpa departemen tidak bisa menyetujui", async () => {
    mocks.getUserPermissions.mockResolvedValue(["lembur:department_only"]);
    const { service, overtimeService } = buildService({
      siteId: "site-a",
      departmentId: null,
    });

    await expect(
      service.approve({ id: "ot-1", session: SESSION }),
    ).rejects.toThrow("Data lembur tidak ditemukan");
    expect(overtimeService.approveRequest).not.toHaveBeenCalled();
  });

  it("lingkup site mengalahkan siteId yang diminta", async () => {
    mocks.getUserPermissions.mockResolvedValue(["lembur:site_only"]);
    const { service, overtimeService } = buildService({
      siteId: "site-a",
      departmentId: null,
    });

    await service.getAdminList({
      session: SESSION,
      page: 1,
      limit: 10,
      siteId: "site-b",
    });

    expect(overtimeService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "site-a" }),
    );
  });

  it("admin di site lain ditolak saat menghapus", async () => {
    mocks.getUserPermissions.mockResolvedValue(["lembur:site_only"]);
    const { service, overtimeService } = buildService({
      siteId: "site-b",
      departmentId: null,
    });

    await expect(
      service.delete({ id: "ot-1", session: SESSION }),
    ).rejects.toThrow("Data lembur tidak ditemukan");
    expect(overtimeService.deleteOvertime).not.toHaveBeenCalled();
  });

  it("role wildcard non-super tidak dianggap dibatasi", async () => {
    mocks.getUserPermissions.mockResolvedValue(["*"]);
    const { service, overtimeService } = buildService({
      siteId: null,
      departmentId: null,
    });

    await service.approve({ id: "ot-1", session: SESSION });

    expect(overtimeService.approveRequest).toHaveBeenCalled();
  });
});
