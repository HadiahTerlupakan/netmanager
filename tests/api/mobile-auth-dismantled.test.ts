import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kontrak yang dibaca aplikasi mobile saat pelanggan di-dismantle: status
 * HTTP dan bentuk JSON tidak berubah (refresh 401, login 403, `error` berisi
 * pesan), hanya pesannya yang kini menjelaskan, ditambah `code` yang stabil.
 */

const mocks = vi.hoisted(() => ({
  tryRefreshCustomerToken: vi.fn(),
  investorRefresh: vi.fn(async () => null),
  tryRefreshMobileToken: vi.fn(),
  customerTryLogin: vi.fn(),
}));

vi.mock("@/modules/investor", () => ({
  getMobileInvestorAuthService: () => ({ refresh: mocks.investorRefresh }),
  tryMobileInvestorLogin: vi.fn(async () => ({ found: false })),
}));
vi.mock("@/modules/mitra", () => ({
  tryMobileMitraLogin: vi.fn(async () => ({ found: false })),
}));
vi.mock("@/modules/app-version", () => ({
  evaluateMobileVersion: vi.fn(async () => ({
    isSupported: true,
    minimum: null,
  })),
  getMinimumMobileVersion: vi.fn(async () => null),
}));
vi.mock("@/modules/users/services/MobileAuthVersionService", () => ({
  MobileAuthVersionService: class {
    checkVersion = async () => ({ response: null as null, minimum: null as null });
  },
}));
vi.mock("@/modules/users/services/MobileCustomerAuthService", () => ({
  MobileCustomerAuthService: class {
    tryLogin = mocks.customerTryLogin;
    tryRefreshToken = mocks.tryRefreshCustomerToken;
  },
}));
vi.mock("@/modules/users/services/MobileEmployeeAuthService", () => ({
  MobileEmployeeAuthService: class {
    tryLogin = async () => ({ found: false });
  },
}));

import { POST as refreshPost } from "@/app/api/mobile/auth/refresh/route";
import { loginMobileRoute } from "@/modules/users/services/MobileAuthRouteService";
import {
  CUSTOMER_DISMANTLED_CODE,
  CUSTOMER_DISMANTLED_MESSAGE,
} from "@/lib/customer-portal-access";

const PESAN = "Layanan Anda sudah berhenti berlangganan. Hubungi admin bila ini keliru.";

describe("pelanggan dismantle di API mobile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memakai pesan dan kode yang disepakati", () => {
    expect(CUSTOMER_DISMANTLED_MESSAGE).toBe(PESAN);
    expect(CUSTOMER_DISMANTLED_CODE).toBe("CUSTOMER_DISMANTLED");
  });

  it("refresh menjawab 401 dengan pesan dismantle tanpa mencoba jalur akun lain", async () => {
    mocks.tryRefreshCustomerToken.mockResolvedValue({ kind: "dismantled" });

    const response = await refreshPost(
      new NextRequest("http://localhost/api/mobile/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "refresh" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: PESAN,
      code: "CUSTOMER_DISMANTLED",
    });
    expect(mocks.investorRefresh).not.toHaveBeenCalled();
    expect(mocks.tryRefreshMobileToken).not.toHaveBeenCalled();
  });

  it("login menjawab 403 dengan pesan dismantle dan kodenya", async () => {
    mocks.customerTryLogin.mockResolvedValue({
      found: true,
      success: false,
      error: PESAN,
      code: "CUSTOMER_DISMANTLED",
      status: 403,
    });

    const response = await loginMobileRoute({
      email: "budi",
      password: "rahasia",
      versionCode: 60,
      loginType: "CUSTOMER",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: PESAN,
      code: "CUSTOMER_DISMANTLED",
    });
  });

  it("login gagal lain tetap memakai kode UNAUTHORIZED", async () => {
    mocks.customerTryLogin.mockResolvedValue({
      found: true,
      success: false,
      error: "Password salah",
      status: 401,
    });

    const response = await loginMobileRoute({
      email: "budi",
      password: "salah",
      versionCode: 60,
      loginType: "CUSTOMER",
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
