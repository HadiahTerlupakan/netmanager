import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiPaginated: (data: unknown, meta: unknown) =>
    NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
}));

const mockGetAttendanceHistory = vi.fn();

vi.mock("@/modules/attendance", () => ({
  AttendanceService: class MockAttendanceService {
    getAttendanceHistory = mockGetAttendanceHistory;
  },
}));

describe("web attendance history route", () => {
  let getWebAttendanceHistory: (typeof import("@/app/api/attendance/history/route"))["GET"];

  beforeAll(async () => {
    ({ GET: getWebAttendanceHistory } =
      await import("@/app/api/attendance/history/route"));
  });

  beforeEach(() => {
    mockGetAttendanceHistory.mockReset();
    mockGetAttendanceHistory.mockResolvedValue({
      attendances: [
        {
          id: "att-after-join",
          checkIn: new Date("2026-04-02T01:00:00.000Z"),
          checkOut: new Date("2026-04-02T10:00:00.000Z"),
          status: "LATE",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("returns filtered history from attendance service", async () => {
    const response = await getWebAttendanceHistory(
      new NextRequest(
        "http://localhost/api/attendance/history?page=1&limit=10",
      ),
      {
        session: {
          user: {
            id: "user-1",
          },
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetAttendanceHistory).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 10,
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("att-after-join");
    expect(body.total).toBe(1);
  });
});
