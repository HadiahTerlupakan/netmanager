import { describe, expect, it, vi } from "vitest";

import { MobileAttendanceCheckoutRouteService } from "@/modules/attendance";

/**
 * Aplikasi memakai satu fungsi untuk check-in maupun check-out, dan keduanya
 * ditolak di sisi aplikasi bila foto atau lokasi kosong. Server dulu tidak
 * memeriksanya sama sekali: check-out dengan body kosong tetap diterima,
 * sehingga jam pulang bisa dicatat tanpa bukti apa pun.
 */

function buatService() {
  const attendanceService = {
    checkOut: vi.fn().mockResolvedValue({
      attendance: { id: "attendance-1" },
      evaluation: { status: "HADIR" },
    }),
  };
  const idempotencyService = {
    resolveRequestId: vi.fn().mockReturnValue("request-1"),
    buildPayloadHash: vi.fn().mockReturnValue("hash-1"),
    begin: vi.fn().mockResolvedValue("started"),
    complete: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };

  return {
    attendanceService,
    service: new MobileAttendanceCheckoutRouteService(
      attendanceService as never,
      idempotencyService as never,
    ),
  };
}

function permintaan(body: Record<string, unknown>) {
  return new Request("http://localhost/api/mobile/attendance/check-out", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000" },
    body: JSON.stringify(body),
  }) as never;
}

describe("MobileAttendanceCheckoutRouteService", () => {
  it("menolak check-out tanpa foto selfie", async () => {
    const { attendanceService, service } = buatService();

    const response = await service.checkOut(
      permintaan({ latitude: -6.2, longitude: 106.8 }),
      "user-1",
      "tenant-1",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "PHOTO_REQUIRED",
    });
    expect(attendanceService.checkOut).not.toHaveBeenCalled();
  });

  it("menolak check-out tanpa koordinat", async () => {
    const { attendanceService, service } = buatService();

    const response = await service.checkOut(
      permintaan({ photoUrl: "/uploads/check-out.jpg" }),
      "user-1",
      "tenant-1",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "LOCATION_REQUIRED",
    });
    expect(attendanceService.checkOut).not.toHaveBeenCalled();
  });

  it("meneruskan check-out yang buktinya lengkap", async () => {
    const { attendanceService, service } = buatService();

    await service.checkOut(
      permintaan({
        photoUrl: "/uploads/check-out.jpg",
        latitude: -6.2,
        longitude: 106.8,
      }),
      "user-1",
      "tenant-1",
    );

    expect(attendanceService.checkOut).toHaveBeenCalled();
  });
});
