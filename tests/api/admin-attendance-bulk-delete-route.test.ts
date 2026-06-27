import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  getUserPermissions: vi.fn().mockResolvedValue([]),
  isSuperAdmin: vi.fn().mockReturnValue(true),
  logActivitySafe: vi.fn(),
  syncApprovedLeaveToAttendanceRange: vi.fn(),
  syncDayOffAttendanceRange: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (
      data: unknown,
      options?: { status?: number; message?: string },
    ) =>
      NextResponse.json(
        {
          success: true,
          data,
          ...(options?.message ? { message: options.message } : {}),
        },
        { status: options?.status ?? 200 },
      ),
  };
});

vi.mock("@/lib/api-response", () => ({
  apiPaginatedWithSummary: (data: unknown, meta: unknown) =>
    NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
  ApiErrors: {
    badRequest: (error: string, details?: unknown) =>
      NextResponse.json(
        { error, ...(details ? { details } : {}) },
        { status: 400 },
      ),
    forbidden: (error: string) => NextResponse.json({ error }, { status: 403 }),
  },
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mockFns.logActivitySafe,
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/attendance/services/LeaveService", () => ({
  LeaveService: class MockLeaveService {
    syncApprovedLeaveToAttendanceRange =
      mockFns.syncApprovedLeaveToAttendanceRange;
  },
}));

vi.mock("@/modules/attendance/services/AbsenceService", () => ({
  AbsenceService: class MockAbsenceService {
    syncDayOffAttendanceRange = mockFns.syncDayOffAttendanceRange;
  },
}));

// CI Jenkins membutuhkan waktu lama untuk dynamic import + transform per-test (~5s
// per `await import("@/app/api/admin/attendance/route")`). 11 dynamic import + load
// lambat di Jenkins kadang melewati 30s default. Naikkan timeout per-test ke 60s.
describe("admin attendance bulk delete route", { timeout: 60000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.hasPermission.mockResolvedValue(true);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdmin.mockReturnValue(true);
    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.attendance.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  it("returns 400 for malformed JSON before touching persistence", async () => {
    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const req = new NextRequest("http://localhost/api/admin/attendance", {
      method: "DELETE",
    });
    vi.spyOn(req, "json").mockRejectedValue(
      new SyntaxError("Unexpected end of JSON input"),
    );

    const response = await DELETE(req, {
      session: {
        user: {
          id: "admin-1",
          tenantId: "tenant-1",
        },
      },
    } as never);

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Data tidak valid");
    expect(prismaMock.attendance.findMany).not.toHaveBeenCalled();
    expect(prismaMock.attendance.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty ids payload before touching persistence", async () => {
    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({ ids: [] }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Data tidak valid");
    expect(prismaMock.attendance.findMany).not.toHaveBeenCalled();
    expect(prismaMock.attendance.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid attendance ids before touching persistence", async () => {
    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({ ids: ["invalid-id"] }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Data tidak valid");
    expect(prismaMock.attendance.findMany).not.toHaveBeenCalled();
    expect(prismaMock.attendance.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 403 and skips persistence when user lacks delete permission", async () => {
    mockFns.hasPermission.mockResolvedValue(false);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: ["550e8400-e29b-41d4-a716-446655440000"],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Akses ditolak");
    expect(prismaMock.attendance.findMany).not.toHaveBeenCalled();
    expect(prismaMock.attendance.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the requested attendance rows and returns a deletion summary", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      { id: "550e8400-e29b-41d4-a716-446655440000" },
      { id: "550e8400-e29b-41d4-a716-446655440001" },
    ] as never);
    prismaMock.attendance.deleteMany.mockResolvedValue({ count: 2 } as never);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: [
            "550e8400-e29b-41d4-a716-446655440000",
            "550e8400-e29b-41d4-a716-446655440001",
            "550e8400-e29b-41d4-a716-446655440001",
          ],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
            ],
          },
        }),
      }),
    );
    expect(prismaMock.attendance.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
            ],
          },
        }),
      }),
    );
    expect(body.data).toEqual({
      requestedCount: 2,
      deletedCount: 2,
      deletedIds: [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
      ],
      skippedCount: 0,
    });
  });

  it("returns skippedCount when some requested attendance ids are not found", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      { id: "550e8400-e29b-41d4-a716-446655440000" },
      { id: "550e8400-e29b-41d4-a716-446655440001" },
    ] as never);
    prismaMock.attendance.deleteMany.mockResolvedValue({ count: 2 } as never);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: [
            "550e8400-e29b-41d4-a716-446655440000",
            "550e8400-e29b-41d4-a716-446655440001",
            "550e8400-e29b-41d4-a716-446655440002",
            "550e8400-e29b-41d4-a716-446655440002",
          ],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
              "550e8400-e29b-41d4-a716-446655440002",
            ],
          },
        }),
      }),
    );
    expect(prismaMock.attendance.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
            ],
          },
        }),
      }),
    );
    expect(body.data).toEqual({
      requestedCount: 3,
      deletedCount: 2,
      deletedIds: [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
      ],
      skippedCount: 1,
    });
  });

  it("does not delete attendances outside site scope for non-superadmin", async () => {
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUserPermissions.mockResolvedValue(["attendance:site_only"]);
    prismaMock.user.findUnique.mockResolvedValue({
      siteId: "site-1",
      departmentId: null,
    } as never);
    prismaMock.attendance.findMany.mockResolvedValue([
      { id: "550e8400-e29b-41d4-a716-446655440000" },
    ] as never);
    prismaMock.attendance.deleteMany.mockResolvedValue({ count: 1 } as never);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: [
            "550e8400-e29b-41d4-a716-446655440000",
            "550e8400-e29b-41d4-a716-446655440001",
          ],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "admin-1" }),
      }),
    );
    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: [
              "550e8400-e29b-41d4-a716-446655440000",
              "550e8400-e29b-41d4-a716-446655440001",
            ],
          },
          user: {
            siteId: "site-1",
          },
        }),
      }),
    );
    expect(prismaMock.attendance.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: ["550e8400-e29b-41d4-a716-446655440000"],
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      requestedCount: 2,
      deletedCount: 1,
      deletedIds: ["550e8400-e29b-41d4-a716-446655440000"],
      skippedCount: 1,
    });
  });

  it("applies department scope for non-superadmin with attendance:department_only", async () => {
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUserPermissions.mockResolvedValue([
      "attendance:department_only",
    ]);
    prismaMock.user.findUnique.mockResolvedValue({
      siteId: null,
      departmentId: "department-1",
    } as never);
    prismaMock.attendance.findMany.mockResolvedValue([
      { id: "550e8400-e29b-41d4-a716-446655440100" },
    ] as never);
    prismaMock.attendance.deleteMany.mockResolvedValue({ count: 1 } as never);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: [
            "550e8400-e29b-41d4-a716-446655440100",
            "550e8400-e29b-41d4-a716-446655440101",
          ],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          user: {
            departmentId: "department-1",
          },
        }),
      }),
    );
    expect(prismaMock.attendance.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: {
            in: ["550e8400-e29b-41d4-a716-446655440100"],
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      requestedCount: 2,
      deletedCount: 1,
      deletedIds: ["550e8400-e29b-41d4-a716-446655440100"],
      skippedCount: 1,
    });
  });

  it("uses no-match scope when site_only permission has no siteId", async () => {
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUserPermissions.mockResolvedValue(["attendance:site_only"]);
    prismaMock.user.findUnique.mockResolvedValue({
      siteId: null,
      departmentId: null,
    } as never);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: ["550e8400-e29b-41d4-a716-446655440200"],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          user: {
            id: "__NO_SCOPE_MATCH__",
          },
        }),
      }),
    );
    expect(prismaMock.attendance.deleteMany).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      requestedCount: 1,
      deletedCount: 0,
      deletedIds: [],
      skippedCount: 1,
    });
  });

  it("uses no-match scope when department_only permission has no departmentId", async () => {
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUserPermissions.mockResolvedValue([
      "attendance:department_only",
    ]);
    prismaMock.user.findUnique.mockResolvedValue({
      siteId: "site-1",
      departmentId: null,
    } as never);

    const { DELETE } = await import("@/app/api/admin/attendance/route");

    const response = await DELETE(
      new NextRequest("http://localhost/api/admin/attendance", {
        method: "DELETE",
        body: JSON.stringify({
          ids: ["550e8400-e29b-41d4-a716-446655440300"],
        }),
      }),
      {
        session: {
          user: {
            id: "admin-1",
            tenantId: "tenant-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          user: {
            id: "__NO_SCOPE_MATCH__",
          },
        }),
      }),
    );
    expect(prismaMock.attendance.deleteMany).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      requestedCount: 1,
      deletedCount: 0,
      deletedIds: [],
      skippedCount: 1,
    });
  });
});
