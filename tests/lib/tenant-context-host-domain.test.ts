import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  getToken: vi.fn(),
  jwtVerify: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockFns.headers,
  cookies: mockFns.cookies,
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockFns.getToken,
}));

vi.mock("jose", () => ({
  jwtVerify: mockFns.jwtVerify,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenant: {
      findFirst: mockFns.findFirst,
    },
  },
}));

describe("tenant-context host domain", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/tenant-context");
    mockFns.headers.mockReset();
    mockFns.cookies.mockReset();
    mockFns.getToken.mockReset();
    mockFns.jwtVerify.mockReset();
    mockFns.findFirst.mockReset();

    mockFns.headers.mockResolvedValue(
      new Headers({ host: "tenant-a.example.com" }),
    );
    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    mockFns.getToken.mockResolvedValue(null);
    mockFns.findFirst.mockResolvedValue({
      id: "tenant-1",
      domain: "tenant-a.example.com",
      isActive: true,
    });
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
    process.env.NEXTAUTH_SECRET = "test-secret-123-at-least-32-chars-long";
  });

  it("resolves tenant context from request host when request is public", async () => {
    const { getTenantIdFromContext } = await import("@/lib/tenant-context");

    const result = await getTenantIdFromContext();

    expect(result).toEqual({ tenantId: "tenant-1", isSuperAdmin: false });
    expect(mockFns.findFirst).toHaveBeenCalledWith({
      where: {
        domain: "tenant-a.example.com",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }, 20000);

  it("resolves localhost public request to primary tenant", async () => {
    mockFns.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
    const { MAIN_TENANT_ID } =
      await import("@/modules/mitra/services/tenant-constants");
    const { getTenantIdFromContext } = await import("@/lib/tenant-context");

    const result = await getTenantIdFromContext();

    expect(result).toEqual({
      tenantId: MAIN_TENANT_ID,
      isSuperAdmin: false,
    });
    expect(mockFns.findFirst).not.toHaveBeenCalled();
  }, 20000);
});
