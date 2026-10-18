import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  isUserCurrentlyCheckedIn: vi.fn(),
  saveLocation: vi.fn(),
  saveLocations: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/lib/api-response", () => ({
  apiSuccess: (data: unknown, meta?: { message?: string }) =>
    NextResponse.json(
      { success: true, data, message: meta?.message },
      { status: 200 },
    ),
  apiError: (
    message: string,
    code: string,
    init?: { status?: number; details?: unknown },
  ) =>
    NextResponse.json(
      { success: false, error: message, code, details: init?.details },
      { status: init?.status ?? 500 },
    ),
  ErrorCodes: {
    UNAUTHORIZED: "UNAUTHORIZED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

vi.mock("@/modules/attendance", () => ({
  LocationTrackingService: class MockLocationTrackingService {
    isUserCurrentlyCheckedIn = mockFns.isUserCurrentlyCheckedIn;
    saveLocation = mockFns.saveLocation;
    saveLocations = mockFns.saveLocations;
  },
}));

import { POST } from "@/app/api/mobile/location/route";

describe("mobile location route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({ userId: "user-1" });
    mockFns.isUserCurrentlyCheckedIn.mockResolvedValue(true);
  });

  it("returns 400 for malformed JSON before touching persistence", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/location", {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Data lokasi tidak valid");
    expect(mockFns.isUserCurrentlyCheckedIn).not.toHaveBeenCalled();
    expect(mockFns.saveLocation).not.toHaveBeenCalled();
    expect(mockFns.saveLocations).not.toHaveBeenCalled();
  });

  function postJson(body: unknown) {
    return POST(
      new NextRequest("http://localhost/api/mobile/location", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );
  }

  const point = {
    latitude: -6.2,
    longitude: 106.8,
    recordedAt: "2026-04-10T07:00:00.000Z",
  };

  it("stores a queued offline batch even after the user checked out", async () => {
    mockFns.isUserCurrentlyCheckedIn.mockResolvedValue(false);
    mockFns.saveLocations.mockResolvedValue(1);

    const response = await postJson({ locations: [point] });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ count: 1 });
    expect(mockFns.saveLocations).toHaveBeenCalledWith("user-1", [
      expect.objectContaining({
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      }),
    ]);
  });

  it("tells the phone to stop tracking for a live point outside a session", async () => {
    mockFns.isUserCurrentlyCheckedIn.mockResolvedValue(false);

    const response = await postJson(point);
    const body = await response.json();

    expect(body.data).toEqual({ shouldStopTracking: true });
    expect(mockFns.saveLocation).not.toHaveBeenCalled();
  });

  it("rejects an oversized batch", async () => {
    const response = await postJson({
      locations: Array.from({ length: 201 }, () => point),
    });

    expect(response.status).toBe(400);
    expect(mockFns.saveLocations).not.toHaveBeenCalled();
  });

  it("replaces a recordedAt far ahead of the server clock with server time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T07:00:00.000Z"));
    try {
      await postJson({ ...point, recordedAt: "2026-04-10T09:00:00.000Z" });
    } finally {
      vi.useRealTimers();
    }

    expect(mockFns.saveLocation).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        recordedAt: new Date("2026-04-10T07:00:00.000Z"),
      }),
    );
  });
});
