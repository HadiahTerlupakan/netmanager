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

  it("forwards capturedAt as offlineTime for check-in json payload", async () => {
    const { POST } = await import("@/app/api/mobile/attendance/check-in/route");
    const capturedAt = "2026-03-08T01:00:00.000Z";

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: "HQ",
          capturedAt,
        }),
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(200);
    const checkInSpy = vi.mocked(AttendanceService.prototype.checkIn);
    expect(checkInSpy).toHaveBeenCalledTimes(1);
    expect(checkInSpy.mock.calls[0]?.[0].offlineTime).toBeInstanceOf(Date);
    expect(checkInSpy.mock.calls[0]?.[0].offlineTime?.toISOString()).toBe(
      capturedAt,
    );
  });

  it("rejects invalid capturedAt on check-in json payload", async () => {
    const { POST } = await import("@/app/api/mobile/attendance/check-in/route");

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: "HQ",
          capturedAt: "invalid-date",
        }),
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(400);
    expect(
      vi.mocked(AttendanceService.prototype.checkIn),
    ).not.toHaveBeenCalled();
  });

  it("forwards capturedAt as offlineTime for check-out json payload", async () => {
    const { POST } =
      await import("@/app/api/mobile/attendance/check-out/route");
    const capturedAt = "2026-03-08T09:15:00.000Z";

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: "HQ",
          capturedAt,
        }),
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(200);
    const checkOutSpy = vi.mocked(AttendanceService.prototype.checkOut);
    expect(checkOutSpy).toHaveBeenCalledTimes(1);
    expect(checkOutSpy.mock.calls[0]?.[0].offlineTime).toBeInstanceOf(Date);
    expect(checkOutSpy.mock.calls[0]?.[0].offlineTime?.toISOString()).toBe(
      capturedAt,
    );
  });

  it("rejects invalid capturedAt on check-out json payload", async () => {
    const { POST } =
      await import("@/app/api/mobile/attendance/check-out/route");

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: "HQ",
          capturedAt: "invalid-date",
        }),
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(400);
    expect(
      vi.mocked(AttendanceService.prototype.checkOut),
    ).not.toHaveBeenCalled();
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

  it("returns canonical evaluation fields after check-in mutation", async () => {
    vi.spyOn(AttendanceService.prototype, "checkIn").mockResolvedValueOnce({
      attendance: {
        id: "checkin-1",
        checkIn: new Date("2026-04-01T01:00:00.000Z"),
        status: "ON_TIME",
        location: "HQ",
        geofenceStatus: "INSIDE",
        geofenceSiteName: "Kantor Pusat",
      },
      evaluation: {
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
        payrollHoldState: "NONE",
        reasonCodes: ["APPROVED_LEAVE_OVERRIDES_ATTENDANCE"],
      },
    } as never);

    const { POST } = await import("@/app/api/mobile/attendance/check-in/route");
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: "HQ",
          photoUrl: "/uploads/attendance.jpg",
        }),
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
        payrollHoldState: "NONE",
      },
    });
  });

  it("returns canonical evaluation fields after check-out mutation", async () => {
    vi.spyOn(AttendanceService.prototype, "checkOut").mockResolvedValueOnce({
      attendance: {
        id: "checkout-1",
        checkIn: new Date("2026-04-01T01:00:00.000Z"),
        checkOut: new Date("2026-04-01T09:00:00.000Z"),
        status: "ON_TIME",
      },
      warning: "Jam kerja Anda belum penuh.",
      evaluation: {
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
        payrollHoldState: "ALLOWANCE_HELD",
        reasonCodes: ["APPROVED_LEAVE_OVERRIDES_ATTENDANCE"],
      },
    } as never);

    const { POST } =
      await import("@/app/api/mobile/attendance/check-out/route");
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/attendance/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          location: "HQ",
          photoUrl: "/uploads/attendance.jpg",
        }),
      }),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
      } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        finalStatus: "PERMIT",
        reviewState: "PENDING_REVIEW",
        payrollHoldState: "ALLOWANCE_HELD",
      },
    });
  });
});
