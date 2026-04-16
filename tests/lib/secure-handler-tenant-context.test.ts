import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockVerifyAuth = vi.fn();
const mockIsSuperAdmin = vi.fn();
const mockGetUserPermissions = vi.fn();
const mockRunWithRequestTenantContext = vi.fn(async (_context, callback) => {
  return callback();
});

vi.mock("@/lib/auth", () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  isSuperAdmin: (...args: unknown[]) => mockIsSuperAdmin(...args),
  getUserPermissions: (...args: unknown[]) => mockGetUserPermissions(...args),
}));

vi.mock("@/lib/tenant-context", () => ({
  runWithRequestTenantContext: mockRunWithRequestTenantContext,
}));

describe("secure tenant context", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockVerifyAuth.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      role: "TEKNISI",
      tenantId: "tenant-1",
    });
    mockIsSuperAdmin.mockReturnValue(false);
    mockGetUserPermissions.mockResolvedValue(["barang:read"]);
  });

  it("membungkus handler dengan runWithRequestTenantContext memakai tenant context dari user", async () => {
    const { secure } = await import("@/lib/api/secure-handler");

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const securedHandler = secure(handler);

    const response = await securedHandler(
      new NextRequest("http://localhost/api/test"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockRunWithRequestTenantContext).toHaveBeenCalledTimes(1);
    expect(mockRunWithRequestTenantContext).toHaveBeenCalledWith(
      {
        tenantId: "tenant-1",
        isSuperAdmin: false,
      },
      expect.any(Function),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
