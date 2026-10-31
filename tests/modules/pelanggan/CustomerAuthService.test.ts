import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindByIdentifierForAuth = vi.hoisted(() => vi.fn());
const mockCheckStrictLoginRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
  PelangganRepository: class MockPelangganRepository {
    findByIdentifierForAuth = (...args: unknown[]) =>
      mockFindByIdentifierForAuth(...args);
  },
}));

vi.mock("@/lib/jwt", () => ({
  generatePelangganTokenPair: vi.fn(async () => ({
    accessToken: "akses",
    refreshToken: "segar",
  })),
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
  it("trims surrounding whitespace from the identifier before lookup", async () => {
    mockCheckStrictLoginRateLimit.mockResolvedValueOnce("allowed");
    mockFindByIdentifierForAuth.mockResolvedValueOnce(null);

    const { CustomerAuthService } =
      await import("@/modules/pelanggan/services/CustomerAuthService");

    const service = new CustomerAuthService();
    await service.login("  88888888  ", "secret");

    expect(mockFindByIdentifierForAuth).toHaveBeenCalledWith("88888888");
  });

  // Pelanggan yang diisolir atau dinonaktifkan karena telat bayar harus bisa
  // masuk untuk membayar; dulu semua selain AKTIF ditolak "Akun tidak aktif".
  it.each(["ISOLIR", "NONAKTIF"])(
    "mengizinkan login pelanggan %s",
    async (status) => {
      const { hash } = await import("bcryptjs");
      mockCheckStrictLoginRateLimit.mockResolvedValueOnce("allowed");
      mockFindByIdentifierForAuth.mockResolvedValueOnce({
        id: "pel-1",
        idPelanggan: "67863587",
        nama: "TES LAB 02",
        username: "tes-lab-02",
        email: null,
        status,
        tenantId: "t1",
        passwordHash: await hash("rahasia", 4),
      });

      const { CustomerAuthService } =
        await import("@/modules/pelanggan/services/CustomerAuthService");
      const result = await new CustomerAuthService().login(
        "67863587",
        "rahasia",
      );

      expect(result.success).toBe(true);
    },
  );

  it("menolak login pelanggan dismantle", async () => {
    const { hash } = await import("bcryptjs");
    mockCheckStrictLoginRateLimit.mockResolvedValueOnce("allowed");
    mockFindByIdentifierForAuth.mockResolvedValueOnce({
      id: "pel-1",
      idPelanggan: "67863587",
      nama: "TES LAB 02",
      username: "tes-lab-02",
      email: null,
      status: "DISMANTLE",
      tenantId: "t1",
      passwordHash: await hash("rahasia", 4),
    });

    const { CustomerAuthService } =
      await import("@/modules/pelanggan/services/CustomerAuthService");
    const result = await new CustomerAuthService().login("67863587", "rahasia");

    expect(result).toMatchObject({
      success: false,
      error:
        "Layanan Anda sudah berhenti berlangganan. Hubungi admin bila ini keliru.",
      code: "CUSTOMER_DISMANTLED",
    });
  });
});
