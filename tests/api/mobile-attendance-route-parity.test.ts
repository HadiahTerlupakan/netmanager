import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceService } from "@/modules/attendance/services/AttendanceService";
import { AttendanceTimezoneService } from "@/modules/attendance/services/AttendanceTimezoneService";

const verifySignatureMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/crypto", () => ({
  verifySignature: verifySignatureMock,
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (
    data: unknown,
    options?: { headers?: HeadersInit; message?: string },
  ) =>
    NextResponse.json(
      {
        success: true,
        data,
        ...(options?.message ? { message: options.message } : {}),
      },
      { status: 200, headers: options?.headers },
    ),
  apiError: (message: string, code: string, options?: { status?: number }) =>
    NextResponse.json(
      {
        success: false,
        error: { message, code },
      },
      { status: options?.status ?? 400 },
    ),
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INVALID_COORDINATES: "INVALID_COORDINATES",
    CONFLICT: "CONFLICT",
    OUTSIDE_GEOFENCE: "OUTSIDE_GEOFENCE",
    NO_ACTIVE_SESSION: "NO_ACTIVE_SESSION",
  },
}));

describe("mobile attendance route parity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    verifySignatureMock.mockReset();
    verifySignatureMock.mockReturnValue(true);

    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "getTimezone",
    ).mockResolvedValue("Asia/Jakarta");
    vi.spyOn(AttendanceService.prototype, "checkIn").mockResolvedValue({
      attendance: { id: "checkin-1" },
    } as never);
    vi.spyOn(AttendanceService.prototype, "checkOut").mockResolvedValue({
      attendance: { id: "checkout-1" },
    } as never);
  });

  it("ignores _offline_meta for check-in and uses server-side time only", async () => {
    const { POST } = await import("@/app/api/mobile/attendance/check-in/route");
    const formData = new FormData();
    formData.set("location", "HQ");
    formData.set(
      "_offline_meta",
      JSON.stringify({
        capturedAt: "2026-03-08T01:00:00.000Z",
        signature: "valid-signature",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-in", {
        method: "POST",
        body: formData,
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(200);
    const checkInSpy = vi.mocked(AttendanceService.prototype.checkIn);
    expect(checkInSpy).toHaveBeenCalledTimes(1);
    expect(checkInSpy.mock.calls[0]?.[0].offlineTime).toBeUndefined();
  });

  it("accepts trusted tenant host photoUrl on check-out json payload", async () => {
    const { POST } =
      await import("@/app/api/mobile/attendance/check-out/route");

    const response = await POST(
      new NextRequest(
        "http://tenant.example.com/api/mobile/attendance/check-out",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            host: "tenant.example.com",
          },
          body: JSON.stringify({
            location: "HQ",
            photoUrl: "https://tenant.example.com/uploads/attendance.jpg",
          }),
        },
      ),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(200);
    const checkOutSpy = vi.mocked(AttendanceService.prototype.checkOut);
    expect(checkOutSpy).toHaveBeenCalledTimes(1);
    expect(checkOutSpy.mock.calls[0]?.[0].photoUrl).toBe(
      "https://tenant.example.com/uploads/attendance.jpg",
    );
  });
});
