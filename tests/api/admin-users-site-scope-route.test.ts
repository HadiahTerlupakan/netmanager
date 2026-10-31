import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

/**
 * `users:site_only` dibaca dari `session.user.permissions`, sedangkan
 * `ctx.session` dari `createHandler` tidak membawa izin. Di sini
 * `@/modules/roles` tidak di-mock, jadi pembatasan site yang tidak terbaca
 * terlihat sebagai user di site lain yang ikut lolos.
 */

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: unknown) =>
      NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
  };
});

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  authOptions: {},
  getUserPermissions: vi.fn(),
  invalidatePermissionCache: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: { publish: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    apiRequest: vi.fn(),
    logActivity: vi.fn(),
  },
}));

import { GET } from "@/app/api/admin/users/[id]/route";
import { POST } from "@/app/api/admin/users/route";

const SESI_ADMIN_SITE_1 = {
  user: {
    id: "admin-1",
    email: "admin@example.com",
    role: "ADMIN_SITE",
    tenantId: "tenant-1",
    isSuperAdmin: false,
    siteId: "site-1",
    siteIds: ["site-1"],
  },
};

const userRecord = (id: string, siteId: string): Record<string, unknown> => ({
  id,
  name: `User ${id}`,
  email: `${id}@example.com`,
  phone: null,
  isActive: true,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-02T00:00:00.000Z"),
  departmentId: null,
  siteId,
  roleId: "role-2",
  tenantId: "tenant-1",
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
  sites: { id: siteId, code: siteId.toUpperCase(), name: siteId },
  role: { id: "role-2", name: "STAFF" },
  tenant: { id: "tenant-1", name: "Tenant 1" },
  userSites: [],
});

const getUser = (id: string) =>
  GET(
    new NextRequest(`http://localhost/api/admin/users/${id}`, {
      method: "GET",
    }),
    {
      session: SESI_ADMIN_SITE_1,
      params: { id },
      permissions: ["users:read", "users:site_only"],
    } as never,
  );

describe("rute admin users — admin terbatas site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET [id]: 403 untuk user di site lain", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(
      userRecord("user-2", "site-2") as never,
    );

    const response = await getUser("user-2");

    expect(response.status).toBe(403);
  });

  it("GET [id]: membaca user di site sendiri", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(
      userRecord("user-3", "site-1") as never,
    );

    const response = await getUser("user-3");

    expect(response.status).toBe(200);
  });

  it("POST: 403 untuk user baru di site lain dan tidak ada user dibuat", async () => {
    const body = {
      email: "baru@example.com",
      name: "User Baru",
      password: "rahasia-123",
      roleId: "role-2",
      siteId: "site-2",
    };

    const response = await POST(
      new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
      {
        session: SESI_ADMIN_SITE_1,
        params: {},
        permissions: ["users:create", "users:site_only"],
        validated: body,
      } as never,
    );

    expect(response.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});
