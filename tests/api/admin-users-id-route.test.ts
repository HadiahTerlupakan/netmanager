import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
  invalidatePermissionCache: vi.fn(),
  publish: vi.fn(),
  logActivity: vi.fn(),
  checkSiteRestriction: vi.fn(),
  canAccessSite: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
  invalidatePermissionCache: mockFns.invalidatePermissionCache,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: unknown) =>
      NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
  };
});

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
  canAccessSite: mockFns.canAccessSite,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    apiRequest: vi.fn(),
    logActivity: mockFns.logActivity,
  },
}));

import { DELETE, GET, PATCH } from "@/app/api/admin/users/[id]/route";

describe("admin users id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const formatted = args
        .map((arg) => {
          if (arg instanceof Error) return arg.stack || arg.message;
          if (typeof arg === "object" && arg !== null) {
            return JSON.stringify(arg, Object.getOwnPropertyNames(arg));
          }
          return String(arg);
        })
        .join(" ");
      process.stderr.write(`${formatted}\n`);
    });

    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.com",
        permissions: ["users:update"],
        role: "ADMIN",
      },
    });
    mockFns.getUserPermissions.mockResolvedValue([
      "users:read",
      "users:update",
    ]);
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.invalidatePermissionCache.mockResolvedValue(undefined);
    mockFns.publish.mockResolvedValue(undefined);
    mockFns.logActivity.mockResolvedValue(undefined);
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteId: "site-1",
    });
    mockFns.canAccessSite.mockReturnValue(true);

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      roleId: "role-old",
      siteId: "site-1",
      departmentId: "dept-1",
      isActive: true,
      tenantId: "tenant-1",
    });
    prismaMock.user.update.mockResolvedValue({ id: "user-1" });
    prismaMock.user.delete.mockResolvedValue({
      id: "user-1",
      name: "User 1",
    });

    mockFns.publish.mockResolvedValue(undefined);
  });

  it("allows a user to fetch their own detail without users:read permission", async () => {
    mockFns.getServerSession.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "user@example.com",
        permissions: [],
        role: "STAFF",
      },
    });
    mockFns.getUserPermissions.mockResolvedValueOnce([]);
    mockFns.hasPermission.mockResolvedValueOnce(false);

    prismaMock.user.findUnique.mockImplementationOnce(
      async () =>
        ({
          id: "user-1",
          name: "User 1",
          email: "user@example.com",
          phone: null,
          isActive: true,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-02T00:00:00.000Z"),
          departmentId: null,
          siteId: "site-1",
          roleId: "role-1",
          workingHourMode: "FIXED",
          attendanceGeofencePolicy: "WARN",
          startWorkTime: "09:00",
          endWorkTime: "17:00",
          workDays: "Mon,Tue,Wed,Thu,Fri",
          flexibleTargetHour: 8,
          canvasingTarget: 0,
          targetSchema: "REVENUE",
          isSales: false,
          isAttendanceRequired: true,
          shiftId: null,
          basicSalary: 0,
          payPeriodDay: 1,
          payDay: 25,
          woIncentiveEnabled: false,
          woIncentiveRate: 0,
          lateDeductionRate: 0,
          absentDeductionRate: 0,
          overtimeRateNormal: 0,
          overtimeRateHoliday: 0,
          overtimeRateNational: 0,
          overtimeCalcTypeNormal: "FIXED",
          overtimeCalcTypeHoliday: "FIXED",
          overtimeCalcTypeNational: "FIXED",
          shift: null,
          departments: null,
          sites: { id: "site-1", code: "SITE-1", name: "Site 1" },
          role: { id: "role-1", name: "STAFF" },
          tenant: { id: "tenant-1", name: "Tenant 1" },
          userSites: [],
        }) as never,
    );

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users/user-1", {
        method: "GET",
      }),
      {
        session: { user: { id: "user-1", email: "user@example.com" } },
        params: { id: "user-1" },
      } as never,
    );

    expect(response.status).toBe(200);
  });

  it("returns isAttendanceRequired in the detail payload so exempt users do not rebound to the default required state", async () => {
    prismaMock.user.findUnique.mockImplementationOnce(
      async (_args: { select?: { isAttendanceRequired?: boolean } }) =>
        ({
          id: "user-1",
          name: "Direktur",
          email: "direktur@example.com",
          phone: null,
          isActive: true,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-02T00:00:00.000Z"),
          departmentId: "dept-1",
          siteId: "site-1",
          roleId: "role-1",
          workingHourMode: "FIXED",
          attendanceGeofencePolicy: "WARN",
          startWorkTime: "09:00",
          endWorkTime: "17:00",
          workDays: "Mon,Tue,Wed,Thu,Fri",
          flexibleTargetHour: 8,
          canvasingTarget: null,
          targetSchema: null,
          isSales: false,
          isAttendanceRequired: false,
          shiftId: null,
          basicSalary: null,
          payPeriodDay: null,
          payDay: null,
          woIncentiveEnabled: false,
          woIncentiveRate: null,
          lateDeductionRate: null,
          absentDeductionRate: null,
          overtimeRateNormal: null,
          overtimeRateHoliday: null,
          overtimeRateNational: null,
          overtimeCalcTypeNormal: null,
          overtimeCalcTypeHoliday: null,
          overtimeCalcTypeNational: null,
          shift: null,
          departments: null,
          sites: { id: "site-1", code: "SITE-1", name: "Site 1" },
          role: { id: "role-1", name: "DIREKTUR" },
          tenant: { id: "tenant-1", name: "Tenant 1" },
          userSites: [],
        }) as never,
    );

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users/user-1", {
        method: "GET",
      }),
      {
        session: {
          user: {
            id: "admin-1",
            email: "admin@example.com",
          },
        },
        params: { id: "user-1" },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.isAttendanceRequired).toBe(false);
  });

  it("returns the rich admin detail payload required by the edit screen", async () => {
    prismaMock.user.findUnique.mockImplementationOnce(
      async () =>
        ({
          id: "user-1",
          name: "User 1",
          email: "user@example.com",
          phone: "08123",
          isActive: true,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-02T00:00:00.000Z"),
          departmentId: "dept-1",
          siteId: "site-1",
          roleId: "role-1",
          workingHourMode: "SHIFT",
          attendanceGeofencePolicy: "WARN",
          startWorkTime: null,
          endWorkTime: null,
          workDays: "Mon,Tue,Wed,Thu,Fri",
          flexibleTargetHour: 8,
          canvasingTarget: 0,
          targetSchema: "REVENUE",
          isSales: true,
          isAttendanceRequired: false,
          tenantId: "tenant-1",
          shiftId: "shift-1",
          basicSalary: 0,
          payPeriodDay: 1,
          payDay: 25,
          woIncentiveEnabled: false,
          woIncentiveRate: 0,
          lateDeductionRate: 0,
          absentDeductionRate: 0,
          overtimeRateNormal: 0,
          overtimeRateHoliday: 0,
          overtimeRateNational: 0,
          overtimeCalcTypeNormal: "FIXED",
          overtimeCalcTypeHoliday: "FIXED",
          overtimeCalcTypeNational: "FIXED",
          shift: { id: "shift-1", name: "Shift Pagi" },
          departments: { id: "dept-1", name: "Operasional" },
          sites: { id: "site-1", code: "SITE-1", name: "Site 1" },
          role: { id: "role-1", name: "STAFF" },
          tenant: { id: "tenant-1", name: "Tenant 1" },
          userSites: [
            {
              id: "user-site-1",
              siteId: "site-1",
              isPrimary: true,
              site: { id: "site-1", code: "SITE-1", name: "Site 1" },
            },
          ],
        }) as never,
    );

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users/user-1", {
        method: "GET",
      }),
      {
        session: { user: { id: "admin-1", email: "admin@example.com" } },
        params: { id: "user-1" },
      } as never,
    );

    const body = await response.json();

    expect(body.data.user.workingHourMode).toBe("SHIFT");
    expect(body.data.user.attendanceGeofencePolicy).toBe("WARN");
    expect(body.data.user.shiftId).toBe("shift-1");
    expect(body.data.user.site.code).toBe("SITE-1");
    expect(body.data.user.tenant.id).toBe("tenant-1");
    expect(body.data.user.userSites[0].isPrimary).toBe(true);
    expect(body.data.user.userSites[0].site.code).toBe("SITE-1");
    expect(body.data.user.basicSalary).toBe(0);
    expect(body.data.user.isAttendanceRequired).toBe(false);
  });

  it("rejects cross-site access for site-scoped admins across get, patch, and delete", async () => {
    mockFns.getUserPermissions.mockResolvedValueOnce([
      "users:read",
      "users:update",
      "users:delete",
      "users:site_only",
    ]);
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: true,
      primarySiteId: "site-1",
      siteIds: ["site-1"],
    });
    mockFns.canAccessSite.mockReturnValue(false);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      name: "User 2",
      email: "user2@example.com",
      phone: null,
      isActive: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
      departmentId: null,
      siteId: "site-2",
      roleId: "role-2",
      workingHourMode: "FIXED",
      attendanceGeofencePolicy: "WARN",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      flexibleTargetHour: 8,
      canvasingTarget: 0,
      targetSchema: "REVENUE",
      isSales: false,
      isAttendanceRequired: true,
      shiftId: null,
      basicSalary: 0,
      payPeriodDay: 1,
      payDay: 25,
      woIncentiveEnabled: false,
      woIncentiveRate: 0,
      lateDeductionRate: 0,
      absentDeductionRate: 0,
      overtimeRateNormal: 0,
      overtimeRateHoliday: 0,
      overtimeRateNational: 0,
      overtimeCalcTypeNormal: "FIXED",
      overtimeCalcTypeHoliday: "FIXED",
      overtimeCalcTypeNational: "FIXED",
      shift: null,
      departments: null,
      sites: { id: "site-2", code: "SITE-2", name: "Site 2" },
      role: { id: "role-2", name: "STAFF" },
      tenant: { id: "tenant-1", name: "Tenant 1" },
      userSites: [],
    } as never);

    const getResponse = await GET(
      new NextRequest("http://localhost/api/admin/users/user-2", {
        method: "GET",
      }),
      {
        session: { user: { id: "admin-1", email: "admin@example.com" } },
        params: { id: "user-2" },
      } as never,
    );

    expect(getResponse.status).toBe(403);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "user2@example.com",
      roleId: "role-old",
      siteId: "site-2",
      departmentId: "dept-2",
      isActive: true,
      tenantId: "tenant-1",
    } as never);

    const patchResponse = await PATCH(
      new NextRequest("http://localhost/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ roleId: "role-new" }),
        headers: { "content-type": "application/json" },
      }),
      {
        session: { user: { id: "admin-1", email: "admin@example.com" } },
        params: { id: "user-2" },
        permissions: [
          "users:read",
          "users:update",
          "users:delete",
          "users:site_only",
        ],
        validated: { roleId: "role-new" },
      } as never,
    );

    expect(patchResponse.status).toBe(403);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "user2@example.com",
      roleId: "role-old",
      siteId: "site-2",
      departmentId: "dept-2",
      isActive: true,
      tenantId: "tenant-1",
    } as never);

    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/admin/users/user-2", {
        method: "DELETE",
      }),
      {
        session: { user: { id: "admin-1", email: "admin@example.com" } },
        params: { id: "user-2" },
        permissions: [
          "users:read",
          "users:update",
          "users:delete",
          "users:site_only",
        ],
      } as never,
    );

    expect(deleteResponse.status).toBe(403);
  });

  it("publishes the permissions update through canonical Firebase realtime without waiting for the legacy socket producer", async () => {
    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PATCH",
      body: JSON.stringify({ roleId: "role-new" }),
      headers: { "content-type": "application/json" },
    });

    const responsePromise = PATCH(request, {
      session: {
        user: {
          id: "admin-1",
          email: "admin@example.com",
        },
      },
      params: { id: "user-1" },
      validated: { roleId: "role-new" },
    } as never);

    const result = await Promise.race([
      responsePromise.then(() => "response"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 0)),
    ]);

    expect(result).toBe("response");

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "user.permissions_update",
      scope: { kind: "user", id: "user-1" },
      payload: { userId: "user-1" },
    });
  });
});
