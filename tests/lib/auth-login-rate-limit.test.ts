import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";

const mockCompare = vi.hoisted(() => vi.fn());
const mockCheckStrictLoginRateLimit = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({
  compare: (...args: unknown[]) => mockCompare(...args),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({ handler: true })),
  getToken: vi.fn(),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: unknown) => config,
}));

vi.mock("@/lib/security/login-rate-limit", () => ({
  checkStrictLoginRateLimit: (...args: unknown[]) =>
    mockCheckStrictLoginRateLimit(...args),
  isLoginRateLimitEnabled: () => true,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE:
    "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
}));

describe("auth credential rate limit guardrails", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.DISABLE_RATE_LIMIT;
    prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
  });

  it("fails closed when admin login rate limit storage is unavailable", async () => {
    mockCheckStrictLoginRateLimit.mockResolvedValueOnce("unavailable");

    const { authConfig } = await import("@/lib/auth");
    const credentialsProvider = authConfig.providers?.[0] as unknown as {
      authorize: (
        credentials: Record<string, string>,
        request: Record<string, unknown>,
      ) => Promise<unknown>;
    };

    await expect(
      credentialsProvider.authorize(
        {
          identifier: "admin@example.com",
          password: "secret",
        },
        {},
      ),
    ).rejects.toThrow(
      "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
    );

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
