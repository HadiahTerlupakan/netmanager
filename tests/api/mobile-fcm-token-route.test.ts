import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

const mockGetMobileAuthPayload = vi.fn();

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileOrCustomerAuthPayload: (request: Request) =>
    mockGetMobileAuthPayload(request),
}));

import { POST } from "@/app/api/mobile/fcm-token/route";

/** Bentuk token FCM: id instans, titik dua, lalu muatan base64url. */
const TOKEN_FCM_1 = `${"a".repeat(22)}:APA91b${"1".repeat(134)}`;
const TOKEN_FCM_2 = `${"b".repeat(22)}:APA91b${"2".repeat(134)}`;

describe("POST /api/mobile/fcm-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Klaim token melepasnya dari pemilik lain; di sini tidak ada pemilik lain.
    prismaMock.$queryRaw.mockResolvedValue([]);
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
    // appendOwnerToken sekarang atomic via $transaction (read-merge-write)
    // — H15 fix untuk cegah duplicate token dari race login + tokenRefresh.
    prismaMock.$transaction.mockImplementationOnce(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock),
    );
    prismaMock.user.findUnique.mockResolvedValueOnce({ fcmTokens: [] });
    prismaMock.user.update.mockResolvedValueOnce({ id: "user-1" });

    const request = new NextRequest("http://localhost/api/mobile/fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcmToken: TOKEN_FCM_1, action: "add" }),
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
          set: [TOKEN_FCM_1],
        },
        pushTokenUpdatedAt: expect.any(Date),
      },
    });
  });

  // Cron cleanup-stale-fcm-tokens mengosongkan token yang pushTokenUpdatedAt-nya
  // lebih dari 30 hari. Dulu kolom itu hanya diperbarui registrasi Expo, jadi
  // token FCM karyawan aktif ikut terhapus tiap malam. Sinkron token (setiap
  // aplikasi dibuka) kini menyegarkannya, walau tokennya sudah tersimpan.
  it("menyegarkan pushTokenUpdatedAt walau token sudah tersimpan", async () => {
    mockGetMobileAuthPayload.mockResolvedValueOnce({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "ADMIN",
    });
    prismaMock.user.findFirst.mockResolvedValueOnce({
      id: "user-1",
      tenantId: "tenant-1",
      fcmTokens: [TOKEN_FCM_1],
    });
    prismaMock.$transaction.mockImplementationOnce(
      async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock),
    );
    prismaMock.user.findUnique.mockResolvedValueOnce({
      fcmTokens: [TOKEN_FCM_1],
      tenantId: "tenant-1",
    });
    prismaMock.user.update.mockResolvedValueOnce({ id: "user-1" });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/fcm-token", {
        method: "POST",
        body: JSON.stringify({ fcmToken: TOKEN_FCM_1, action: "add" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { pushTokenUpdatedAt: expect.any(Date) },
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
      fcmTokens: [TOKEN_FCM_1, TOKEN_FCM_2],
    });
    prismaMock.mitra.update.mockResolvedValueOnce({ id: "mitra-1" });

    const request = new NextRequest("http://localhost/api/mobile/fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcmToken: TOKEN_FCM_1, action: "remove" }),
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
          set: [TOKEN_FCM_2],
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
      error: "fcmToken tidak valid",
      code: "VALIDATION_ERROR",
    });
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.mitra.update).not.toHaveBeenCalled();
  });
});
