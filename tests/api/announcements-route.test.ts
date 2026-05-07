import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  logActivity: vi.fn(),
  sendExpoPushNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: mockFns.requireAuth,
}));

vi.mock("@/lib/realtime", () => ({
  firebaseRealtimeService: {
    publish: mockFns.publish,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: mockFns.logActivity,
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

vi.mock("@/lib/expo", () => ({
  sendExpoPushNotifications: mockFns.sendExpoPushNotifications,
}));

import { POST } from "@/app/api/announcements/route";

describe("announcements route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireAuth.mockResolvedValue({
      user: { id: "admin-1" },
    });
    prismaMock.announcement.create.mockResolvedValue({
      id: "ann-1",
      title: "Pengumuman",
      content: "Isi",
      target: "ADMIN",
      isPinned: false,
      createdAt: new Date("2026-03-08T10:00:00.000Z"),
    });
    prismaMock.leaveRequest.findMany.mockResolvedValue([]);
    prismaMock.pelanggan.findMany.mockResolvedValue([]);
  });

  it("targets admin announcements to admin and super admin roles with the correct prisma relation", async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([
        { id: "admin-1", pushToken: "token-1" },
        { id: "super-1", pushToken: "token-2" },
      ])
      .mockResolvedValueOnce([{ id: "admin-1" }, { id: "super-1" }]);

    const response = await POST(
      new NextRequest("http://localhost/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: "Pengumuman",
          content: "Isi",
          target: "ADMIN",
          isActive: true,
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          role: { is: { accessAdminPanel: true } },
        }),
      }),
    );
    expect(prismaMock.notifications.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "admin-1",
          sourceType: "ANNOUNCEMENT",
        }),
        expect.objectContaining({
          userId: "super-1",
          sourceType: "ANNOUNCEMENT",
        }),
      ],
    });
    expect(prismaMock.user.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          isActive: true,
          role: { is: { accessAdminPanel: true } },
        },
        select: { id: true },
      }),
    );
  });

  it("publishes active admin announcements through Firebase realtime admin scope", async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "admin-1", pushToken: "token-1" }])
      .mockResolvedValueOnce([{ id: "admin-1" }]);

    const response = await POST(
      new NextRequest("http://localhost/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: "Realtime Announcement",
          content: "Isi realtime",
          target: "ADMIN",
          isActive: true,
          isPinned: true,
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFns.publish).toHaveBeenCalledWith({
      type: "announcement.new",
      scope: { kind: "admin", id: "announcements" },
      payload: {
        id: "ann-1",
        title: "Pengumuman",
        content: "Isi",
        target: "ADMIN",
        isPinned: false,
        createdAt: "2026-03-08T10:00:00.000Z",
      },
    });
  });

  it("publishes active customer announcements through per-customer user scopes", async () => {
    prismaMock.announcement.create.mockResolvedValueOnce({
      id: "ann-2",
      title: "Pengumuman Pelanggan",
      content: "Isi pelanggan",
      target: "CUSTOMER",
      isPinned: true,
      createdAt: new Date("2026-03-08T11:00:00.000Z"),
    });
    prismaMock.pelanggan.findMany.mockResolvedValueOnce([
      { id: "customer-1" },
      { id: "customer-2" },
    ]);

    const response = await POST(
      new NextRequest("http://localhost/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: "Realtime Customer Announcement",
          content: "Isi realtime pelanggan",
          target: "CUSTOMER",
          isActive: true,
          isPinned: true,
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFns.publish).toHaveBeenNthCalledWith(1, {
      type: "announcement.new",
      scope: { kind: "user", id: "customer-1" },
      payload: {
        id: "ann-2",
        title: "Pengumuman Pelanggan",
        content: "Isi pelanggan",
        target: "CUSTOMER",
        isPinned: true,
        createdAt: "2026-03-08T11:00:00.000Z",
      },
    });
    expect(mockFns.publish).toHaveBeenNthCalledWith(2, {
      type: "announcement.new",
      scope: { kind: "user", id: "customer-2" },
      payload: {
        id: "ann-2",
        title: "Pengumuman Pelanggan",
        content: "Isi pelanggan",
        target: "CUSTOMER",
        isPinned: true,
        createdAt: "2026-03-08T11:00:00.000Z",
      },
    });
  });

  it("still returns success when Firebase realtime publish fails after creating the announcement", async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "admin-1", pushToken: "token-1" }])
      .mockResolvedValueOnce([{ id: "admin-1" }]);
    mockFns.publish.mockRejectedValueOnce(new Error("realtime down"));

    const response = await POST(
      new NextRequest("http://localhost/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: "Realtime Failure",
          content: "Isi realtime failure",
          target: "ADMIN",
          isActive: true,
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
  });

  it("does not wait for Firebase realtime publish before finishing the POST response", async () => {
    const deferredPublish = createDeferred<void>();
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "admin-1", pushToken: "token-1" }])
      .mockResolvedValueOnce([{ id: "admin-1" }]);
    mockFns.publish.mockReturnValueOnce(deferredPublish.promise);

    const responsePromise = POST(
      new NextRequest("http://localhost/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: "Deferred Realtime",
          content: "Isi deferred realtime",
          target: "ADMIN",
          isActive: true,
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await Promise.race([
      responsePromise.then(() => "response"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 0)),
    ]);

    expect(result).toBe("response");
    expect(mockFns.logActivity).toHaveBeenCalled();
    expect(mockFns.publish).toHaveBeenCalledTimes(1);
    deferredPublish.resolve(undefined);
    await responsePromise;
  });
});
