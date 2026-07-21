import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getCompletionSummary: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockFns.verifyAuth,
}));

vi.mock("@/modules/marketing", async () => {
  const actual = await vi.importActual<typeof import("@/modules/marketing")>(
    "@/modules/marketing",
  );

  return {
    ...actual,
    createCanvasingService: () => ({
      getCompletionSummary: mockFns.getCompletionSummary,
    }),
  };
});

import { GET } from "@/app/api/marketing/canvasing/summary/route";

describe("GET /api/marketing/canvasing/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      permissions: ["canvasing:read"],
    });
    mockFns.getCompletionSummary.mockResolvedValue({
      total: 1,
      woStartedToday: 0,
      completedToday: 0,
      completedWeek: 0,
      completedMonth: 0,
      pending: 1,
      approved: 0,
      rejected: 0,
    });
  });

  it("selalu scope personal (canReadAll=false) meski user punya canvasing:read", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/summary"),
    );

    expect(response.status).toBe(200);
    expect(mockFns.getCompletionSummary).toHaveBeenCalledWith({
      canReadAll: false,
      userId: "user-1",
    });
  });

  it("mengembalikan 401 jika tidak terautentikasi", async () => {
    mockFns.verifyAuth.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/summary"),
    );

    expect(response.status).toBe(401);
    expect(mockFns.getCompletionSummary).not.toHaveBeenCalled();
  });
});
