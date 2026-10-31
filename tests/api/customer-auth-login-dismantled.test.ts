import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route login portal dulu menebak status HTTP dari isi pesan ("tidak aktif"
 * → 403). Pesan dismantle yang baru tidak memuat frasa itu, jadi statusnya
 * kini diambil dari kode, dan kode itu ikut di respons.
 */

const mocks = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("@/modules/pelanggan", () => ({
  CustomerAuthService: class {
    login = mocks.login;
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => true,
  getClientIP: () => "203.0.113.7",
  RATE_LIMITS: { login: {} },
}));
vi.mock("@/lib/security-logger", () => ({
  logSecurityEvent: vi.fn(),
  trackFailedLogin: vi.fn(async () => 1),
  blockIp: vi.fn(),
  isIpBlocked: vi.fn(async () => false),
  getBlockTimeRemaining: vi.fn(async () => 0),
  resetFailedLoginCounter: vi.fn(),
}));

import { POST } from "@/app/api/customer/auth/login/route";

const PESAN = "Layanan Anda sudah berhenti berlangganan. Hubungi admin bila ini keliru.";

function loginRequest() {
  return new NextRequest("https://pelanggan.radpro.id/api/customer/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "67863587", password: "rahasia" }),
  });
}

describe("POST /api/customer/auth/login untuk pelanggan dismantle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menjawab 403 dengan pesan dan kode dismantle", async () => {
    mocks.login.mockResolvedValue({
      success: false,
      error: PESAN,
      code: "CUSTOMER_DISMANTLED",
    });

    const response = await POST(loginRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: PESAN,
      code: "CUSTOMER_DISMANTLED",
    });
  });

  it("password salah tetap 401 UNAUTHORIZED", async () => {
    mocks.login.mockResolvedValue({
      success: false,
      error: "ID Pelanggan atau password salah",
    });

    const response = await POST(loginRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
