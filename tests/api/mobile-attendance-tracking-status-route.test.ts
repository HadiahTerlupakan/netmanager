import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";
import { trackingStatusReportSchema } from "@/modules/attendance/validation";

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown, message = "OK", status = 200) =>
    NextResponse.json({ success: true, message, data }, { status }),
}));

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  getTimezoneSync: vi.fn().mockReturnValue("Asia/Jakarta"),
}));

const NOW = new Date("2026-10-18T03:00:00.000Z");

describe("POST /api/mobile/attendance/tracking-status", () => {
  let POST: (typeof import("@/app/api/mobile/attendance/tracking-status/route"))["POST"];

  beforeAll(async () => {
    ({ POST } =
      await import("@/app/api/mobile/attendance/tracking-status/route"));
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prismaMock.attendance.findFirst.mockResolvedValue({
      id: "att-1",
      checkIn: new Date("2026-10-18T01:00:00.000Z"),
      checkOut: null,
      status: "ON_TIME",
      user: { workingHourMode: "FIXED", flexibleTargetHour: null, shift: null },
    } as never);
  });

  it("stores the status on the employee's running session", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/mobile/attendance/tracking-status",
        {
          method: "POST",
        },
      ),
      {
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
        validated: { status: "GPS_OFF" },
      } as never,
    );

    expect((await response.json()).data).toEqual({ recorded: true });
    expect(prismaMock.attendance.update).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { trackingStatus: "GPS_OFF", trackingStatusAt: NOW },
    });
  });

  it("only accepts the statuses the app knows how to send", () => {
    expect(
      trackingStatusReportSchema.safeParse({ status: "BACKGROUND_DENIED" })
        .success,
    ).toBe(true);
    expect(
      trackingStatusReportSchema.safeParse({ status: "SOMETHING_ELSE" })
        .success,
    ).toBe(false);
  });
});
