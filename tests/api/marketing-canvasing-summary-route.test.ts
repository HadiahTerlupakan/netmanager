import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getUserPermissions: vi.fn(),
  isSuperAdminRole: vi.fn(),
  getCompletionSummary: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyAuth: mockFns.verifyAuth,
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/lib/auth-helpers", () => ({
  isSuperAdminRole: mockFns.isSuperAdminRole,
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
    });
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.isSuperAdminRole.mockReturnValue(false);
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

  it("menggunakan permissions dari session tanpa query ulang", async () => {
    mockFns.verifyAuth.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      permissions: ["canvasing:read"],
    });

    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/summary"),
    );

    expect(response.status).toBe(200);
    expect(mockFns.getUserPermissions).not.toHaveBeenCalled();
    expect(mockFns.getCompletionSummary).toHaveBeenCalledWith({
      canReadAll: true,
      userId: "user-1",
    });
  });

  it("fallback ke getUserPermissions ketika session tidak membawa permissions", async () => {
    mockFns.getUserPermissions.mockResolvedValue(["canvasing:read"]);

    const response = await GET(
      new NextRequest("http://localhost/api/marketing/canvasing/summary"),
    );

    expect(response.status).toBe(200);
    expect(mockFns.getUserPermissions).toHaveBeenCalledWith("user-1");
    expect(mockFns.getCompletionSummary).toHaveBeenCalledWith({
      canReadAll: true,
      userId: "user-1",
    });
  });
});
