import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  loggerApiRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: vi.fn((data: unknown) => Response.json({ success: true, data })),
  ApiErrors: {
    badRequest: (message: string) =>
      Response.json({ success: false, error: message }, { status: 400 }),
    unauthorized: () =>
      Response.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    forbidden: (message: string) =>
      Response.json({ success: false, error: message }, { status: 403 }),
    notFound: (message: string) =>
      Response.json({ success: false, error: message }, { status: 404 }),
  },
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockFns.loggerInfo,
    error: mockFns.loggerError,
    apiRequest: mockFns.loggerApiRequest,
  },
}));

import { GET } from "@/app/api/admin/users/[id]/performance/route";

describe("admin user performance route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      workingHourMode: "FIXED",
      flexibleTargetHour: 8,
    } as never);
    prismaMock.attendance.groupBy.mockResolvedValue([] as never);
    prismaMock.leaveRequest.groupBy.mockResolvedValue([] as never);
    prismaMock.workOrders.count.mockResolvedValue(0 as never);
    prismaMock.workOrders.findMany.mockResolvedValue([] as never);
    prismaMock.workOrders.aggregate.mockResolvedValue({
      _avg: { rating: null },
    } as never);
  });

  it("does not count NO_CHECKOUT records as absent in attendance summary", async () => {
    prismaMock.attendance.groupBy.mockResolvedValue([
      { status: "NO_CHECKOUT", _count: { _all: 2 } },
      { status: "ABSENT", _count: { _all: 1 } },
      { status: "LATE", _count: { _all: 3 } },
      { status: "ON_TIME", _count: { _all: 4 } },
    ] as never);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users/user-1/performance"),
      {
        session: { user: { id: "admin-1" } },
        params: { id: "user-1" },
        permissions: ["users:read"],
      } as never,
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.attendance).toMatchObject({
      present: 4,
      late: 3,
      absent: 1,
      total: 8,
    });
  });
});
