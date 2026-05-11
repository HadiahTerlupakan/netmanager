import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompare = vi.hoisted(() => vi.fn());
const mockPrismaAdapter = vi.hoisted(() => vi.fn(() => ({})));
const mockNextAuth = vi.hoisted(() => vi.fn(() => ({ handler: true })));

vi.mock("bcryptjs", () => ({
  compare: (...args: Parameters<typeof mockCompare>) => mockCompare(...args),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: (...args: Parameters<typeof mockPrismaAdapter>) =>
    mockPrismaAdapter(...args),
}));

vi.mock("next-auth", () => ({
  default: mockNextAuth,
  getToken: vi.fn(),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: unknown) => config,
}));

vi.mock("@/lib/security/login-rate-limit", () => ({
  checkStrictLoginRateLimit: vi.fn(),
  isLoginRateLimitEnabled: () => false,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE:
    "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
}));

describe("auth config lazy initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...process.env, NODE_ENV: "production" };
  });

  it("does not build prisma adapter or auth handler when importing session config", async () => {
    const { authConfig, authOptions } = await import("@/lib/auth");

    expect(authConfig).toBe(authOptions);
    expect(mockPrismaAdapter).not.toHaveBeenCalled();
    expect(mockNextAuth).not.toHaveBeenCalled();
  });

  it("builds prisma adapter and providers only when full auth config is requested", async () => {
    const { createAuthConfig } = await import("@/lib/auth");
    const fullConfig = await createAuthConfig();

    expect(mockPrismaAdapter).toHaveBeenCalledTimes(1);
    expect(fullConfig.providers).toHaveLength(1);
  });
});
