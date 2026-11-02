import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  createLeave: vi.fn(),
  getLeaveById: vi.fn(),
  approveLeave: vi.fn(),
  getAllBalances: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserPermissions: mocks.getUserPermissions,
}));
vi.mock("@/modules/attendance/services/LeaveService", () => ({
  getLeaveService: () => ({
    createLeave: mocks.createLeave,
    getLeaveById: mocks.getLeaveById,
    approveLeave: mocks.approveLeave,
  }),
}));

import { AdminLeaveRouteService } from "@/modules/attendance/services/AdminLeaveRouteService";
import { AdminLeaveBalanceRouteService } from "@/modules/attendance/services/AdminLeaveBalanceRouteService";

const ADMIN = { id: "admin-1", role: "ADMIN", tenantId: "t1" };
const SESSION = { user: ADMIN } as never;

type LookupUser = {
  id: string;
  tenantId?: string;
  siteId: string | null;
  departmentId: string | null;
};

function lookupOf(users: LookupUser[]) {
  return {
    findById: vi.fn(
      async (id: string) => users.find((u) => u.id === id) ?? null,
    ),
  };
}

const CREATE_INPUT = {
  userId: "emp-1",
  type: "CUTI",
  startDate: new Date("2026-11-03"),
  endDate: new Date("2026-11-04"),
  reason: "keluarga",
  session: SESSION,
} as never;

describe("AdminLeaveRouteService — lingkup izin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createLeave.mockResolvedValue({ success: true, data: {} });
    mocks.approveLeave.mockResolvedValue({ success: true });
  });

  it("menolak membuat izin untuk pegawai site lain", async () => {
    mocks.getUserPermissions.mockResolvedValue(["izin:site_only"]);
    const service = new AdminLeaveRouteService(
      lookupOf([
        { id: "admin-1", siteId: "site-a", departmentId: null },
        { id: "emp-1", siteId: "site-b", departmentId: null },
      ]) as never,
    );

    const result = await service.createLeave(CREATE_INPUT);

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(mocks.createLeave).not.toHaveBeenCalled();
  });

  it("mengizinkan membuat izin untuk pegawai di site yang sama", async () => {
    mocks.getUserPermissions.mockResolvedValue(["izin:site_only"]);
    const service = new AdminLeaveRouteService(
      lookupOf([
        { id: "admin-1", siteId: "site-a", departmentId: null },
        { id: "emp-1", siteId: "site-a", departmentId: null },
      ]) as never,
    );

    await service.createLeave(CREATE_INPUT);

    expect(mocks.createLeave).toHaveBeenCalled();
  });

  it("admin terbatas tanpa site tidak bisa menyetujui izin", async () => {
    mocks.getUserPermissions.mockResolvedValue(["izin:site_only"]);
    mocks.getLeaveById.mockResolvedValue({
      success: true,
      data: { id: "lv-1", user: { siteId: "site-b", departmentId: null } },
    });
    const service = new AdminLeaveRouteService(
      lookupOf([{ id: "admin-1", siteId: null, departmentId: null }]) as never,
    );

    const result = await service.updateStatus({
      id: "lv-1",
      status: "APPROVED",
      session: SESSION,
    });

    expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
    expect(mocks.approveLeave).not.toHaveBeenCalled();
  });
});

describe("AdminLeaveBalanceRouteService — lingkup", () => {
  const access = {
    requesterTenantId: "t1",
    isSuperAdmin: false,
    actor: ADMIN,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllBalances.mockResolvedValue([]);
  });

  it.each(["attendance:site_only", "izin:site_only", "users:site_only"])(
    "%s: pegawai site lain tidak bisa diakses",
    async (siteOnly) => {
      mocks.getUserPermissions.mockResolvedValue([siteOnly]);
      const service = new AdminLeaveBalanceRouteService(
        { getAllBalances: mocks.getAllBalances } as never,
        lookupOf([
          {
            id: "admin-1",
            tenantId: "t1",
            siteId: "site-a",
            departmentId: null,
          },
          { id: "emp-1", tenantId: "t1", siteId: "site-b", departmentId: null },
        ]) as never,
      );

      await expect(service.canAccessUser("emp-1", access)).resolves.toBe(false);
    },
  );

  it("daftar saldo dibatasi ke site admin", async () => {
    mocks.getUserPermissions.mockResolvedValue(["attendance:site_only"]);
    const service = new AdminLeaveBalanceRouteService(
      { getAllBalances: mocks.getAllBalances } as never,
      lookupOf([
        { id: "admin-1", tenantId: "t1", siteId: "site-a", departmentId: null },
      ]) as never,
    );

    await service.getBalances({ year: 2026, access });

    expect(mocks.getAllBalances).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({ tenantId: "t1", siteId: "site-a" }),
    );
  });

  it("admin terbatas tanpa site mendapat daftar kosong", async () => {
    mocks.getUserPermissions.mockResolvedValue(["izin:department_only"]);
    const service = new AdminLeaveBalanceRouteService(
      { getAllBalances: mocks.getAllBalances } as never,
      lookupOf([
        { id: "admin-1", tenantId: "t1", siteId: "site-a", departmentId: null },
      ]) as never,
    );

    const result = await service.getBalances({ year: 2026, access });

    expect(result).toEqual({ balances: [], year: 2026 });
    expect(mocks.getAllBalances).not.toHaveBeenCalled();
  });

  it("admin tanpa pembatasan tetap melihat pegawai mana pun di tenant", async () => {
    mocks.getUserPermissions.mockResolvedValue(["attendance:read"]);
    const service = new AdminLeaveBalanceRouteService(
      { getAllBalances: mocks.getAllBalances } as never,
      lookupOf([
        { id: "admin-1", tenantId: "t1", siteId: "site-a", departmentId: null },
        { id: "emp-1", tenantId: "t1", siteId: null, departmentId: null },
      ]) as never,
    );

    await expect(service.canAccessUser("emp-1", access)).resolves.toBe(true);
  });
});
