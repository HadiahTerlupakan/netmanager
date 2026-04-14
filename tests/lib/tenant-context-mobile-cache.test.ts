import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  verifyMobileToken: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockFns.headers,
}));

vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: mockFns.verifyMobileToken,
}));

describe("tenant-context mobile bearer cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/tenant-context");
    mockFns.verifyMobileToken.mockReset();
    mockFns.headers.mockReset();
    mockFns.headers.mockResolvedValue(
      new Headers({ authorization: "Bearer valid-token" }),
    );
    mockFns.verifyMobileToken.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
  });

  it("memoize tenant context mobile bearer untuk pemanggilan berulang dalam request yang sama", async () => {
    const { getTenantIdFromContext } = await import("@/lib/tenant-context");

    const first = await getTenantIdFromContext();
    const second = await getTenantIdFromContext();

    expect(first).toEqual({ tenantId: "tenant-1", isSuperAdmin: false });
    expect(second).toEqual({ tenantId: "tenant-1", isSuperAdmin: false });
    expect(mockFns.verifyMobileToken).toHaveBeenCalledTimes(1);
  });
});
