import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getRecentSessions: vi.fn(),
}));

vi.mock("@/modules/network", () => ({
  RadiusDashboardService: class MockRadiusDashboardService {
    getRecentSessions = mockFns.getRecentSessions;
  },
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (
      req: NextRequest,
      ctx: { session: { user: { tenantId: string } } },
    ) => unknown,
  ) => {
    return (req: NextRequest) =>
      handler(req, { session: { user: { tenantId: "tenant-1" } } });
  },
  apiSuccess: (data: unknown) => ({ success: true, data }),
  ApiErrors: {
    badRequest: (message: string) => ({
      success: false,
      error: message,
      status: 400,
    }),
    forbidden: (message: string) => ({
      success: false,
      error: message,
      status: 403,
    }),
  },
}));

import { GET } from "@/app/api/admin/radius/dashboard/recent-sessions/route";

describe("GET /api/admin/radius/dashboard/recent-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid status values instead of falling back to active", async () => {
    const response = await (
      GET as unknown as (req: NextRequest) => Promise<unknown>
    )(
      new NextRequest(
        "http://localhost/api/admin/radius/dashboard/recent-sessions?status=paused",
      ),
    );
    const json = response as unknown as {
      success: boolean;
      error?: string;
      status?: number;
    };

    expect(json.success).toBe(false);
    expect(json.error).toBe(
      "Query parameter status harus bernilai active atau all",
    );
    expect(json.status).toBe(400);
    expect(mockFns.getRecentSessions).not.toHaveBeenCalled();
  });
});
