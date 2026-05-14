import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  headers: vi.fn(),
  approveLeave: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockFns.headers,
}));

vi.mock("@/modules/attendance/services/LeaveService", () => ({
  getLeaveService: () => ({ approveLeave: mockFns.approveLeave }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findMany: mockFns.findMany,
    },
  },
  prismaAuth: {
    leaveRequest: {
      findMany: mockFns.findMany,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    CRON_SECRET: "cron-secret",
  }),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: vi.fn().mockResolvedValue("acquired"),
  CRON_LOCK_UNAVAILABLE_MESSAGE: "Lock unavailable",
}));

import { POST } from "@/app/api/cron/auto-approve-leave/route";

describe("auto-approve leave cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mockFns.headers.mockResolvedValue({
      get: (name: string) =>
        name === "authorization" ? "Bearer cron-secret" : null,
    });
  });

  it("routes auto-approval through LeaveService.approveLeave for each pending request", async () => {
    mockFns.findMany.mockResolvedValue([
      {
        id: "leave-1",
        userId: "user-1",
        tenantId: "tenant-1",
        startDate: new Date("2026-03-10T00:00:00.000Z"),
        user: { id: "user-1", name: "Budi" },
      },
    ]);
    mockFns.approveLeave.mockResolvedValue({
      success: true,
      data: { id: "leave-1" },
    });

    const response = await POST(
      new Request("http://localhost/api/cron/auto-approve-leave", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(mockFns.approveLeave).toHaveBeenCalledWith(
      "leave-1",
      "SYSTEM_AUTO",
      "tenant-1",
    );
    expect(json.data.approvedCount).toBe(1);
    expect(json.data.approvedIds).toEqual(["leave-1"]);
  });
});
