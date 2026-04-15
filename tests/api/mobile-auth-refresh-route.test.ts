import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mobile/auth/refresh/route";

const mockGetMobileTokenDetails = vi.fn();
const mockVerifyMobileRefreshToken = vi.fn();
const mockSignMobileToken = vi.fn();
const mockSignMobileRefreshToken = vi.fn();
const mockVerifyPelangganRefreshToken = vi.fn();
const mockGeneratePelangganAccessToken = vi.fn();
const mockGeneratePelangganRefreshToken = vi.fn();
const mockFindCustomer = vi.fn();

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: (...args: unknown[]) =>
    mockGetMobileTokenDetails(...args),
  verifyMobileRefreshToken: (...args: unknown[]) =>
    mockVerifyMobileRefreshToken(...args),
  signMobileToken: (...args: unknown[]) => mockSignMobileToken(...args),
  signMobileRefreshToken: (...args: unknown[]) =>
    mockSignMobileRefreshToken(...args),
}));

vi.mock("@/lib/jwt", () => ({
  verifyPelangganRefreshToken: (...args: unknown[]) =>
    mockVerifyPelangganRefreshToken(...args),
  generatePelangganAccessToken: (...args: unknown[]) =>
    mockGeneratePelangganAccessToken(...args),
  generatePelangganRefreshToken: (...args: unknown[]) =>
    mockGeneratePelangganRefreshToken(...args),
}));

vi.mock("@/modules/database", () => ({
  prismaAuth: {
    pelanggan: {
      findUnique: (...args: unknown[]) => mockFindCustomer(...args),
    },
  },
}));

describe("POST /api/mobile/auth/refresh", () => {
  beforeEach(() => {
    mockGetMobileTokenDetails.mockReset();
    mockVerifyMobileRefreshToken.mockReset();
    mockSignMobileToken.mockReset();
    mockSignMobileRefreshToken.mockReset();
    mockVerifyPelangganRefreshToken.mockReset();
    mockGeneratePelangganAccessToken.mockReset();
    mockGeneratePelangganRefreshToken.mockReset();
    mockFindCustomer.mockReset();

    mockVerifyPelangganRefreshToken.mockResolvedValue({ id: "", valid: false });
  });

  it("returns fresh access and refresh token for valid mobile refresh token", async () => {
    mockGetMobileTokenDetails.mockResolvedValue({
      payload: {
        sub: "user-1",
        userId: "user-1",
        id: "user-1",
        email: "user@example.com",
        role: "USER",
        type: "refresh",
        appVersionCode: 55,
        appVersionName: "1.2.3",
      },
      versionCode: 55,
      versionAccess: {
        isSupported: true,
        minimumVersion: 50,
        latestVersion: 55,
        isForceUpdate: false,
        updateAvailable: false,
      },
    });
    mockVerifyMobileRefreshToken.mockResolvedValue({
      sub: "user-1",
      userId: "user-1",
      id: "user-1",
      email: "user@example.com",
      role: "USER",
      type: "refresh",
      appVersionCode: 55,
      appVersionName: "1.2.3",
    });
    mockSignMobileToken.mockResolvedValue("next-access-token");
    mockSignMobileRefreshToken.mockResolvedValue("next-refresh-token");

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-app-version-code": "55",
          "x-app-version-name": "1.2.3",
        },
        body: JSON.stringify({ refreshToken: "refresh-token-value" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      token: "next-access-token",
      refreshToken: "next-refresh-token",
    });
    expect(mockGetMobileTokenDetails).toHaveBeenCalledWith(
      "refresh-token-value",
      55,
    );
    expect(mockVerifyMobileRefreshToken).toHaveBeenCalledWith(
      "refresh-token-value",
      55,
    );
    expect(mockSignMobileToken).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "refresh",
        appVersionCode: 55,
        appVersionName: "1.2.3",
      }),
    );
  });

  it("returns refreshed customer tokens for valid customer refresh token", async () => {
    mockVerifyPelangganRefreshToken.mockResolvedValue({
      id: "cust-1",
      valid: true,
    });
    mockFindCustomer.mockResolvedValue({
      id: "cust-1",
      idPelanggan: "PEL-1",
      nama: "Customer One",
      username: "cust-one",
      status: "AKTIF",
      tenantId: "tenant-1",
    });
    mockGeneratePelangganAccessToken.mockReturnValue("customer-access-token");
    mockGeneratePelangganRefreshToken.mockResolvedValue(
      "customer-refresh-token",
    );

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-app-version-code": "55",
          "x-app-version-name": "1.2.3",
        },
        body: JSON.stringify({ refreshToken: "customer-refresh-token-old" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      token: "customer-access-token",
      refreshToken: "customer-refresh-token",
    });
    expect(mockGeneratePelangganAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cust-1",
        appVersionCode: 55,
        appVersionName: "1.2.3",
      }),
      "7d",
    );
    expect(mockGetMobileTokenDetails).not.toHaveBeenCalled();
  });

  it("rejects missing refresh token payload", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid refresh token payload", async () => {
    mockGetMobileTokenDetails.mockResolvedValue({
      payload: {
        sub: "user-1",
        userId: "user-1",
        type: "refresh",
      },
      versionCode: 55,
      versionAccess: {
        isSupported: true,
        minimumVersion: 50,
        latestVersion: 55,
        isForceUpdate: false,
        updateAvailable: false,
      },
    });
    mockVerifyMobileRefreshToken.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "invalid-refresh-token" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 426 when mobile refresh token belongs to unsupported app version", async () => {
    mockGetMobileTokenDetails.mockResolvedValue({
      payload: {
        sub: "user-1",
        userId: "user-1",
        type: "refresh",
      },
      versionCode: 40,
      versionAccess: {
        isSupported: false,
        minimumVersion: 50,
        latestVersion: 55,
        isForceUpdate: true,
        updateAvailable: true,
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "stale-refresh-token" }),
      }),
    );

    expect(response.status).toBe(426);
  });
});
