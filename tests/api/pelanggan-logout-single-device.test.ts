import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PELANGGAN_SESI,
  useStatefulPelangganStores,
} from "../helpers/pelanggan-session-stores";
import {
  generatePelangganTokenPair,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";

const mockPerformMobileLogout = vi.hoisted(() => vi.fn());
const mockGetMobileAuthPayload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mobile-investor-auth", () => ({
  getInvestorMobileSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/modules/investor", () => ({
  getMobileInvestorAuthService: vi.fn(),
}));
vi.mock("@/modules/users", () => ({
  performMobileLogout: mockPerformMobileLogout,
}));
vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockGetMobileAuthPayload,
}));

import { POST as webLogout } from "@/app/api/customer/auth/logout/route";
import { POST as mobileLogout } from "@/app/api/mobile/auth/logout/route";

async function isRefreshValid(refreshToken: string) {
  return (await verifyPelangganRefreshToken(refreshToken)).valid;
}

describe("logout pelanggan hanya mengakhiri perangkat itu", () => {
  beforeEach(() => {
    useStatefulPelangganStores();
    mockPerformMobileLogout.mockReset();
    mockGetMobileAuthPayload.mockReset();
  });

  it("web logout keeps the mobile app signed in", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    const res = await webLogout(
      new NextRequest("http://localhost/api/customer/auth/logout", {
        method: "POST",
        headers: { cookie: `customer-refresh-token=${web.refreshToken}` },
      }),
    );

    expect(res.status).toBe(200);
    expect(await isRefreshValid(web.refreshToken)).toBe(false);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(true);
  });

  it("mobile logout keeps the web portal signed in", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);

    const res = await mobileLogout(
      new NextRequest("http://localhost/api/mobile/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${mobile.accessToken}` },
      }),
    );

    expect(res.status).toBe(200);
    expect(await isRefreshValid(mobile.refreshToken)).toBe(false);
    expect(await isRefreshValid(web.refreshToken)).toBe(true);
    expect(mockPerformMobileLogout).not.toHaveBeenCalled();
  });

  it("mobile logout of an employee token still goes through the employee path", async () => {
    mockGetMobileAuthPayload.mockResolvedValue({ id: "user-1", role: "ADMIN" });

    const res = await mobileLogout(
      new NextRequest("http://localhost/api/mobile/auth/logout", {
        method: "POST",
        headers: { authorization: "Bearer token-karyawan" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPerformMobileLogout).toHaveBeenCalledWith({
      userId: "user-1",
      role: "ADMIN",
    });
  });
});
