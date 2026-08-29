import { describe, expect, it, vi } from "vitest";

import { MobileAttendanceCheckInRouteService } from "@/modules/attendance";

function createService() {
  const attendance = {
    checkIn: vi.fn().mockResolvedValue({
      attendance: { id: "attendance-1" },
      evaluation: { status: "HADIR" },
    }),
  };
  const idempotency = {
    resolveRequestId: vi.fn().mockReturnValue("request-1"),
    buildPayloadHash: vi.fn().mockReturnValue("hash-1"),
    begin: vi.fn().mockResolvedValue("started"),
    getReplay: vi.fn(),
    complete: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const timezone = {
    getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  };
  const photo = {
    processPhoto: vi.fn(),
  };

  return {
    attendance,
    idempotency,
    timezone,
    photo,
    service: new MobileAttendanceCheckInRouteService({
      attendance: attendance as never,
      idempotency: idempotency as never,
      timezone: timezone as never,
      photo: photo as never,
    }),
  };
}

describe("MobileAttendanceCheckInRouteService", () => {
  it("memproses check-in JSON dan menyelesaikan idempotency", async () => {
    const { attendance, idempotency, service } = createService();
    const request = new Request(
      "http://localhost/api/mobile/attendance/check-in",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-1",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          location: "Kantor",
          notes: "Pagi",
          latitude: -6.2,
          longitude: 106.8,
          photoUrl: "/uploads/check-in.jpg",
        }),
      },
    );

    const result = await service.checkIn({
      request,
      user: { id: "user-1", tenantId: "tenant-1" },
    });

    expect(attendance.checkIn).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-1",
      timezone: "Asia/Jakarta",
      location: "Kantor",
      notes: "Pagi",
      latitude: -6.2,
      longitude: 106.8,
      photoUrl: "/uploads/check-in.jpg",
      offlineTime: undefined,
    });
    expect(idempotency.complete).toHaveBeenCalledWith(
      "user-1",
      "check-in",
      "request-1",
      "hash-1",
      {
        success: true,
        data: {
          id: "attendance-1",
          status: "HADIR",
          canonical: { status: "HADIR" },
        },
      },
    );
    expect(result).toEqual({
      success: true,
      data: {
        success: true,
        data: {
          id: "attendance-1",
          status: "HADIR",
          canonical: { status: "HADIR" },
        },
      },
    });
  });

  it("menolak koordinat JSON yang tidak valid", async () => {
    const { attendance, service } = createService();
    const request = new Request(
      "http://localhost/api/mobile/attendance/check-in",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: 120, longitude: 106.8 }),
      },
    );

    const result = await service.checkIn({
      request,
      user: { id: "user-1", tenantId: "tenant-1" },
    });

    expect(result).toEqual({
      success: false,
      status: 400,
      code: "INVALID_COORDINATES",
      error: "Latitude harus antara -90 dan 90",
    });
    expect(attendance.checkIn).not.toHaveBeenCalled();
  });

  it("mengembalikan 409 ketika check-in duplikat, bukan 400", async () => {
    // 409 adalah status yang direkonsiliasi antrean offline mobile; 400
    // diklasifikasikan sebagai permanent failure sehingga absensi dibuang.
    const { attendance, service } = createService();
    attendance.checkIn.mockRejectedValue(new Error("DUPLICATE_ENTRY"));
    const request = new Request(
      "http://localhost/api/mobile/attendance/check-in",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          location: "Kantor",
          latitude: -6.2,
          longitude: 106.8,
        }),
      },
    );

    const result = await service.checkIn({
      request,
      user: { id: "user-1", tenantId: "tenant-1" },
    });

    expect(result).toMatchObject({
      success: false,
      status: 409,
      code: "ALREADY_CHECKED_IN",
    });
  });

  it("mengembalikan replay ketika idempotency sudah completed", async () => {
    const { attendance, idempotency, service } = createService();
    idempotency.begin.mockResolvedValue("completed");
    idempotency.getReplay.mockResolvedValue({
      success: true,
      data: { id: "old" },
    });
    const request = new Request(
      "http://localhost/api/mobile/attendance/check-in",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-1",
        },
        body: JSON.stringify({ location: "Kantor" }),
      },
    );

    const result = await service.checkIn({
      request,
      user: { id: "user-1", tenantId: "tenant-1" },
    });

    expect(result).toEqual({
      success: true,
      data: { success: true, data: { id: "old" } },
      idempotentReplay: true,
    });
    expect(attendance.checkIn).not.toHaveBeenCalled();
  });
});
