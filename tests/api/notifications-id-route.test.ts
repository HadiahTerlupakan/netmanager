import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockFns = vi.hoisted(() => ({
  getReadableNotificationForUser: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  updateNotificationCount: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: (
      _options: unknown,
      handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>,
    ) => handler,
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
    ApiErrors: {
      notFound: (msg: string) =>
        NextResponse.json({ error: msg }, { status: 404 }),
      badRequest: (msg: string) =>
        NextResponse.json({ error: msg }, { status: 400 }),
      forbidden: (msg: string) =>
        NextResponse.json({ error: msg }, { status: 403 }),
    },
  };
});

vi.mock("@/modules/notification/api", () => ({
  getReadableNotificationForUser: mockFns.getReadableNotificationForUser,
  getUnreadCount: mockFns.getUnreadCount,
  markAsRead: mockFns.markAsRead,
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    updateNotificationCount: mockFns.updateNotificationCount,
  },
}));

import { PATCH } from "@/app/api/notifications/[id]/route";

type RouteContext = Parameters<typeof PATCH>[1];

const buildContext = (
  id: string,
  overrides?: {
    permissions?: string[];
    siteId?: string;
    departmentId?: string;
  },
): RouteContext =>
  ({
    params: { id },
    session: {
      user: {
        id: "user-1",
        departmentId: overrides?.departmentId ?? "dept-1",
        siteId: overrides?.siteId ?? "site-1",
        role: "USER",
      },
    },
    permissions: overrides?.permissions ?? [],
  }) as unknown as RouteContext;

describe("web notifications id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUnreadCount.mockResolvedValue(4);
  });

  it("marks a readable notification as read", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({
      id: "notif-1",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications/notif-1", {
        method: "PATCH",
      }),
      buildContext("notif-1"),
    );
    const json = await response.json();

    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith(
      "notif-1",
      "user-1",
      {
        departmentId: "dept-1",
        siteId: undefined,
      },
    );
    expect(mockFns.markAsRead).toHaveBeenCalledWith("notif-1");
    expect(mockFns.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      undefined,
      undefined,
      "dept-1",
    );
    expect(mockFns.updateNotificationCount).toHaveBeenCalledWith("user-1", 4);
    expect(json.success).toBe(true);
  });

  it("reuses session permissions for site-only users after mark read", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce({
      id: "notif-site-1",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications/notif-site-1", {
        method: "PATCH",
      }),
      buildContext("notif-site-1", { permissions: ["site_only"] }),
    );

    expect(response.status).toBe(200);
    expect(mockFns.getUserPermissions).not.toHaveBeenCalled();
    expect(mockFns.getReadableNotificationForUser).toHaveBeenCalledWith(
      "notif-site-1",
      "user-1",
      {
        departmentId: "dept-1",
        siteId: "site-1",
      },
    );
    expect(mockFns.getUnreadCount).toHaveBeenCalledWith(
      "user-1",
      undefined,
      "site-1",
      "dept-1",
    );
    expect(mockFns.updateNotificationCount).toHaveBeenCalledWith("user-1", 4);
  });

  it("returns 404 when the notification is hidden from the user", async () => {
    mockFns.getReadableNotificationForUser.mockResolvedValueOnce(null);

    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications/notif-2", {
        method: "PATCH",
      }),
      buildContext("notif-2"),
    );

    expect(response.status).toBe(404);
    expect(mockFns.markAsRead).not.toHaveBeenCalled();
  });
});
