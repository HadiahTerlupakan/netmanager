import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTryInvestorLogin = vi.hoisted(() => vi.fn());
const mockInvestorRefresh = vi.hoisted(() => vi.fn());
const mockInvestorLogout = vi.hoisted(() => vi.fn());
const mockInvestorProfile = vi.hoisted(() => vi.fn());
const mockInvestorSession = vi.hoisted(() => vi.fn());
const mockGetMobileAuthPayload = vi.hoisted(() => vi.fn());
const mockTryRefreshCustomer = vi.hoisted(() => vi.fn());
const mockTryRefreshMobile = vi.hoisted(() => vi.fn());
const mockPerformMobileLogout = vi.hoisted(() => vi.fn());

vi.mock("@/modules/investor", () => ({
  tryMobileInvestorLogin: mockTryInvestorLogin,
  getMobileInvestorAuthService: () => ({
    refresh: mockInvestorRefresh,
    logout: mockInvestorLogout,
    getProfile: mockInvestorProfile,
  }),
}));
vi.mock("@/lib/mobile-investor-auth", () => ({
  getInvestorMobileSession: mockInvestorSession,
}));
vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockGetMobileAuthPayload,
  getMobileRequestVersionReport: () => ({ versionCode: 20 }),
}));

describe("login mobile — akun investor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("identitas yang bukan karyawan/mitra/pelanggan dicoba sebagai investor", async () => {
    vi.doMock("@/modules/database", () => ({
      prisma: {},
      prismaAuth: {
        user: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
        pelanggan: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
      },
      prismaMitraAuth: { mitra: { findFirst: vi.fn().mockResolvedValue(null) } },
    }));
    vi.doMock("@/lib/mobile-auth", () => ({
      getMitraMobileCapabilities: vi.fn(),
      signMobileRefreshToken: vi.fn(),
      signMobileToken: vi.fn(),
    }));
    vi.doMock("@/modules/marketing", () => ({ getUserFeaturesWithCanvasing: vi.fn() }));
    mockTryInvestorLogin.mockResolvedValue({
      found: true,
      success: true,
      data: { token: "akses", refreshToken: "segar", user: { id: "inv-1", role: "INVESTOR" } },
    });
    const { POST } = await import("@/app/api/mobile/auth/login/route");

    const response = await POST(
      new Request("http://localhost/api/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "pakbudi", password: "rahasia", versionCode: 20 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      token: "akses",
      user: { role: "INVESTOR" },
    });
    expect(mockTryInvestorLogin).toHaveBeenCalledWith(
      expect.objectContaining({ email: "pakbudi", password: "rahasia" }),
    );
  });
});

describe("refresh / me / logout mobile — akun investor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("@/modules/users", () => ({
      tryRefreshCustomerToken: mockTryRefreshCustomer,
      tryRefreshMobileToken: mockTryRefreshMobile,
      performMobileLogout: mockPerformMobileLogout,
      getMobileEmployeeMe: vi.fn(),
    }));
    vi.doMock("@/modules/mitra", () => ({ getMobileMitraMe: vi.fn() }));
    vi.doMock("@/modules/marketing", () => ({ getUserFeaturesWithCanvasing: vi.fn() }));
    mockTryRefreshCustomer.mockResolvedValue({ kind: "invalid" });
  });

  it("refresh token investor ditukar oleh service investor, bukan jalur karyawan", async () => {
    mockInvestorRefresh.mockResolvedValue({ token: "akses-baru", refreshToken: "segar-baru" });
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");

    const response = await POST(
      new Request("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "segar" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      token: "akses-baru",
      refreshToken: "segar-baru",
    });
    expect(mockInvestorRefresh).toHaveBeenCalledWith("segar", { versionCode: 20 });
    expect(mockTryRefreshMobile).not.toHaveBeenCalled();
  });

  it("refresh token bukan investor tetap lewat jalur karyawan", async () => {
    mockInvestorRefresh.mockResolvedValue(null);
    mockTryRefreshMobile.mockResolvedValue({ kind: "invalid" });
    const { POST } = await import("@/app/api/mobile/auth/refresh/route");

    const response = await POST(
      new Request("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "token-karyawan" }),
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(mockTryRefreshMobile).toHaveBeenCalled();
  });

  it("/me mengembalikan profil investor dari sesi investor", async () => {
    mockInvestorSession.mockResolvedValue({ id: "inv-1" });
    mockInvestorProfile.mockResolvedValue({ id: "inv-1", role: "INVESTOR" });
    const { GET } = await import("@/app/api/mobile/auth/me/route");

    const response = await GET(new Request("http://localhost/api/mobile/auth/me") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { role: "INVESTOR" } });
    expect(mockGetMobileAuthPayload).not.toHaveBeenCalled();
  });

  it("logout investor mencabut token investor, bukan user karyawan", async () => {
    mockInvestorSession.mockResolvedValue({ id: "inv-1" });
    const { POST } = await import("@/app/api/mobile/auth/logout/route");

    const response = await POST(
      new Request("http://localhost/api/mobile/auth/logout", { method: "POST" }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockInvestorLogout).toHaveBeenCalledWith("inv-1");
    expect(mockPerformMobileLogout).not.toHaveBeenCalled();
  });
});
