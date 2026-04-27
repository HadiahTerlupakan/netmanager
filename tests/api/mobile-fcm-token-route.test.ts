import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

const mockGetMobileAuthPayload = vi.fn();

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: (request: Request) => mockGetMobileAuthPayload(request),
}));

import { POST } from "@/app/api/mobile/fcm-token/route";

describe("POST /api/mobile/fcm-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores an FCM token for authenticated mobile users using userId payload field", async () => {
    mockGetMobileAuthPayload.mockResolvedValueOnce({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "ADMIN",
    });
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "user-1",
      tenantId: "tenant-1",
      fcmTokens: [],
    });
    prismaMock.user.update.mockResolvedValueOnce({ id: "user-1" });

    const request = new NextRequest("http://localhost/api/mobile/fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcmToken: "fcm-token-1", action: "add" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: null,
      message: "FCM token berhasil disimpan",
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user-1", tenantId: "tenant-1" },
      select: { id: true, fcmTokens: true },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        fcmTokens: {
          push: "fcm-token-1",
        },
      },
    });
  });

  it("removes an FCM token from mitra records", async () => {
    mockGetMobileAuthPayload.mockResolvedValueOnce({
      userId: "mitra-1",
      tenantId: "tenant-1",
      role: "MITRA",
    });
    prismaMock.mitra.findFirst.mockResolvedValueOnce({
      id: "mitra-1",
      tenantId: "tenant-1",
      fcmTokens: ["fcm-token-1", "fcm-token-2"],
    });
    prismaMock.mitra.update.mockResolvedValueOnce({ id: "mitra-1" });

    const request = new NextRequest("http://localhost/api/mobile/fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcmToken: "fcm-token-1", action: "remove" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: null,
      message: "FCM token berhasil dihapus",
    });
    expect(prismaMock.mitra.findFirst).toHaveBeenCalledWith({
      where: { id: "mitra-1", tenantId: "tenant-1" },
      select: { id: true, fcmTokens: true },
    });
    expect(prismaMock.mitra.update).toHaveBeenCalledWith({
      where: { id: "mitra-1" },
      data: {
        fcmTokens: {
          set: ["fcm-token-2"],
        },
      },
    });
  });

  it("rejects requests without an fcmToken", async () => {
    mockGetMobileAuthPayload.mockResolvedValueOnce({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "ADMIN",
    });

    const request = new NextRequest("http://localhost/api/mobile/fcm-token", {
      method: "POST",
      body: JSON.stringify({ action: "add" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: "fcmToken wajib diisi",
      code: "VALIDATION_ERROR",
    });
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.mitra.update).not.toHaveBeenCalled();
  });
});
