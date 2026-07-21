import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  forceLogoutUser: vi.fn(),
  forceLogout: vi.fn(),
  logActivity: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: unknown) =>
      NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
    ApiErrors: {
      badRequest: (message: string) =>
        NextResponse.json({ error: message }, { status: 400 }),
      forbidden: (message: string) =>
        NextResponse.json({ error: message }, { status: 403 }),
      notFound: (entity: string) =>
        NextResponse.json({ error: `${entity} not found` }, { status: 404 }),
      unauthorized: () =>
        NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    },
  };
});

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: { forceLogout: mockFns.forceLogout },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    apiRequest: mockFns.apiRequest,
    logActivity: mockFns.logActivity,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/validations/user", () => ({
  forceLogoutSchema: { parse: (value: unknown) => value },
}));

vi.mock("@/modules/users", () => ({
  AdminUserRouteService: class {
    forceLogoutUser = mockFns.forceLogoutUser;
  },
}));

describe("POST /api/admin/users/[id]/force-logout", () => {
  let POST: (typeof import("@/app/api/admin/users/[id]/force-logout/route"))["POST"];

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/admin/users/[id]/force-logout/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps service 403 to forbidden and does not emit socket", async () => {
    mockFns.forceLogoutUser.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 403,
        message: "Anda hanya dapat force logout user di site Anda",
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/users/u2/force-logout", {
        method: "POST",
        body: "{}",
      }),
      {
        params: { id: "u2" },
        session: { user: { id: "admin-1", tenantId: "t1" } },
        permissions: ["users:force_logout"],
      } as never,
    );

    expect(response.status).toBe(403);
    expect(mockFns.forceLogout).not.toHaveBeenCalled();
  });

  it("on success calls scoped service and emits forceLogout", async () => {
    mockFns.forceLogoutUser.mockResolvedValueOnce({
      ok: true,
      data: { id: "u2", name: "Budi", tokenVersion: 4 },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/users/u2/force-logout", {
        method: "POST",
        body: "{}",
      }),
      {
        params: { id: "u2" },
        session: { user: { id: "admin-1", tenantId: "t1" } },
        permissions: ["users:force_logout"],
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.forceLogoutUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "admin-1" }),
      }),
      "u2",
    );
    expect(mockFns.forceLogout).toHaveBeenCalledWith("u2");
  });
});
