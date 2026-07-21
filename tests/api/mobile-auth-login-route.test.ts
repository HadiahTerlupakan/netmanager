import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompare = vi.fn();
const mockCustomerFindFirst = vi.fn();
const mockCustomerUpdate = vi.fn();
const mockEvaluateVersionAccess = vi.fn();
const mockGeneratePelangganAccessToken = vi.fn();
const mockGeneratePelangganRefreshToken = vi.fn();

vi.mock("bcryptjs", () => ({
  compare: (...args: unknown[]) => mockCompare(...args),
}));

vi.mock("@/modules/database", () => ({
  prisma: {},
  prismaAuth: {
    pelanggan: {
      findFirst: (...args: unknown[]) => mockCustomerFindFirst(...args),
      update: (...args: unknown[]) => mockCustomerUpdate(...args),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
  prismaMitraAuth: {
    mitra: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMitraMobileCapabilities: vi.fn(),
  signMobileRefreshToken: vi.fn(),
  signMobileToken: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  generatePelangganAccessToken: (...args: unknown[]) =>
    mockGeneratePelangganAccessToken(...args),
  generatePelangganRefreshToken: (...args: unknown[]) =>
    mockGeneratePelangganRefreshToken(...args),
}));

vi.mock("@/modules/marketing", () => ({
  getUserFeaturesWithCanvasing: vi.fn(),
}));

import { POST } from "@/app/api/mobile/auth/login/route";

describe("POST /api/mobile/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluateVersionAccess.mockResolvedValue({
      isSupported: true,
      minimumVersionCode: null,
      latestVersion: null,
    });
    mockCompare.mockResolvedValue(true);
    mockGeneratePelangganAccessToken.mockReturnValue("customer-access-token");
    mockGeneratePelangganRefreshToken.mockResolvedValue(
      "customer-refresh-token",
    );
  });

  it("persists trusted customer app version metadata on mobile login", async () => {
    mockCustomerFindFirst.mockResolvedValue({
      id: "cust-1",
      idPelanggan: "PEL-1",
      nama: "Customer One",
      username: "cust-one",
      email: "cust@example.com",
      passwordHash: "hashed-password",
      password: null,
      status: "AKTIF",
      tenantId: "tenant-1",
      alamat: "Jl. Test",
      hargaPaket: { name: "Paket Internet" },
    });

    const response = await POST(
      new Request("http://localhost/api/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "cust-one",
          password: "secret",
          loginType: "CUSTOMER",
          versionCode: 55,
          versionName: "1.2.3",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockCustomerUpdate).toHaveBeenCalledWith({
      where: { id: "cust-1" },
      data: {
        lastVersionCode: 55,
        lastVersionName: "1.2.3",
        lastOtaUpdateId: null,
        lastLoginAt: expect.any(Date),
        lastVersionUpdate: expect.any(Date),
      },
    });
    expect(mockGeneratePelangganAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        appVersionCode: 55,
        appVersionName: "1.2.3",
      }),
      "15m",
    );
    expect(mockGeneratePelangganRefreshToken).toHaveBeenCalledWith("cust-1", {
      appVersionCode: 55,
      appVersionName: "1.2.3",
    });
  });
});
