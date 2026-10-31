import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompare = vi.fn();
const mockCustomerFindFirst = vi.fn();
const mockCustomerUpdate = vi.fn();
const mockGeneratePelangganAccessToken = vi.fn();
const mockGeneratePelangganRefreshToken = vi.fn();
const mockEvaluateMobileVersion = vi.hoisted(() => vi.fn());

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
  createPelangganSessionId: () => "sesi-1",
  generatePelangganAccessToken: (...args: unknown[]) =>
    mockGeneratePelangganAccessToken(...args),
  generatePelangganRefreshToken: (...args: unknown[]) =>
    mockGeneratePelangganRefreshToken(...args),
}));

vi.mock("@/modules/marketing", () => ({
  getUserFeaturesWithCanvasing: vi.fn(),
}));

vi.mock("@/modules/app-version", () => ({
  evaluateMobileVersion: mockEvaluateMobileVersion,
}));

import { logger } from "@/lib/logger";
import { POST } from "@/app/api/mobile/auth/login/route";

const CUSTOMER = {
  id: "cust-1",
  idPelanggan: "PEL-1",
  nama: "Customer One",
  username: "cust-one",
  email: "cust@example.com",
  passwordHash: "hashed-password",
  password: null as string | null,
  status: "AKTIF",
  tenantId: "tenant-1",
  alamat: "Jl. Test",
  hargaPaket: { name: "Paket Internet" },
};

function login(versionCode: number, versionName: string) {
  return POST(
    new Request("http://localhost/api/mobile/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "okhttp/4.12.0",
        "x-forwarded-for": "10.1.2.3",
      },
      body: JSON.stringify({
        email: "cust-one",
        password: "secret",
        loginType: "CUSTOMER",
        versionCode,
        versionName,
      }),
    }),
  );
}

describe("mobile login log", () => {
  const logAuth = vi.spyOn(logger, "logAuth");

  beforeEach(() => {
    vi.clearAllMocks();
    logAuth.mockResolvedValue(undefined);
    mockCompare.mockResolvedValue(true);
    mockCustomerFindFirst.mockResolvedValue(CUSTOMER);
    mockGeneratePelangganAccessToken.mockReturnValue("customer-access-token");
    mockGeneratePelangganRefreshToken.mockResolvedValue(
      "customer-refresh-token",
    );
  });

  it("records a login refused because the app is outdated", async () => {
    mockEvaluateMobileVersion.mockResolvedValue({
      isSupported: false,
      minimum: { versionCode: 49, versionName: "1.0.9" },
    });

    const response = await login(53, "1.0.0");

    expect(response.status).toBe(426);
    expect(logAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN_REJECTED_OUTDATED_APP",
        ipAddress: "10.1.2.3",
        userAgent: "okhttp/4.12.0",
        details: expect.objectContaining({
          email: "cust-one",
          portal: "Aplikasi Mobile",
          stage: "login",
          appVersion: "1.0.0 (build 53)",
          requiredVersion: "1.0.9 (build 49)",
        }),
      }),
    );
  });

  it("records a successful mobile login with the app version", async () => {
    mockEvaluateMobileVersion.mockResolvedValue({
      isSupported: true,
      minimum: null,
    });

    const response = await login(55, "1.2.3");

    expect(response.status).toBe(200);
    expect(logAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN",
        actor: { type: "customer", id: "cust-1" },
        details: expect.objectContaining({
          name: "Customer One",
          portal: "Aplikasi Mobile",
          accountType: "CUSTOMER",
          appVersion: "1.2.3 (build 55)",
        }),
      }),
    );
  });
});
