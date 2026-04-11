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

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/tenant-context");
  process.env = { ...originalEnv };
  process.env.CRON_SECRET = "cron-secret";
  process.env.NEXTAUTH_SECRET = "test-secret-123-at-least-32-chars-long";
  mockFns.verifyMobileToken.mockReset();
  mockFns.headers.mockReset();
  mockFns.headers.mockResolvedValue(
    new Headers({ authorization: "Bearer cron-secret" }),
  );
});

describe("tenant-context cron secret handling", () => {
  it("treats cron bearer secret as super admin context without mobile verification", async () => {
    const { getTenantIdFromContext } = await import("@/lib/tenant-context");

    const result = await getTenantIdFromContext();

    expect(result).toEqual({ tenantId: null, isSuperAdmin: true });
    expect(mockFns.verifyMobileToken).not.toHaveBeenCalled();
  });
});
