import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindByIdentifierForAuth = vi.hoisted(() => vi.fn());
const mockCheckStrictLoginRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
  PelangganRepository: class MockPelangganRepository {
    findByIdentifierForAuth = (...args: unknown[]) =>
      mockFindByIdentifierForAuth(...args);
  },
}));

vi.mock("@/lib/security/login-rate-limit", () => ({
  checkStrictLoginRateLimit: (...args: unknown[]) =>
    mockCheckStrictLoginRateLimit(...args),
  isLoginRateLimitEnabled: () => true,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE:
    "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
}));

describe("CustomerAuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.DISABLE_RATE_LIMIT;
  });

  it("fails closed when customer login rate limit storage is unavailable", async () => {
    mockCheckStrictLoginRateLimit.mockResolvedValueOnce("unavailable");

    const { CustomerAuthService } =
      await import("@/modules/pelanggan/services/CustomerAuthService");

    const service = new CustomerAuthService();
    const result = await service.login("CUST-001", "secret");

    expect(result).toEqual({
      success: false,
      error: "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.",
    });
    expect(mockFindByIdentifierForAuth).not.toHaveBeenCalled();
  });
});
