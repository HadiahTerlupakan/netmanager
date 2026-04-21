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
});
