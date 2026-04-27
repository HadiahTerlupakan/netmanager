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

import { GET, PATCH } from "@/app/api/admin/users/[id]/route";

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
    mockFns.getUserPermissions.mockResolvedValue(["users:update"]);
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

    mockFns.publish.mockResolvedValue(undefined);
  });

  it("returns isAttendanceRequired in the detail payload so exempt users do not rebound to the default required state", async () => {
    prismaMock.user.findUnique.mockImplementationOnce(
      async (args: { select?: { isAttendanceRequired?: boolean } }) =>
        ({
          id: "user-1",
          name: "Direktur",
          email: "direktur@example.com",
          phone: null,
          isActive: true,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
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
          ...(args?.select?.isAttendanceRequired
            ? { isAttendanceRequired: false }
            : {}),
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
