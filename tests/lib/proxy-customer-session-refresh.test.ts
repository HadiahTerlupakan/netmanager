import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

/**
 * Access token pelanggan berumur 15 menit dan tidak pernah diperbarui
 * walau refresh token 7 hari tersimpan: pelanggan dikeluarkan dari portal
 * setiap 15 menit (terjadi berulang kali saat uji pembayaran TES LAB 02).
 */

const palsu = vi.hoisted(() => ({
  getToken: vi.fn(),
  refreshCustomerToken: vi.fn(),
}));
vi.mock("next-auth/jwt", () => ({ getToken: palsu.getToken }));
vi.mock("@/lib/customer-auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  refreshCustomerToken: palsu.refreshCustomerToken,
}));

const SECRET = "test-secret";

function accessToken(expiresIn = 15 * 60) {
  return jwt.sign(
    { id: "pel-1", idPelanggan: "67863587", nama: "TES", status: "ISOLIR" },
    SECRET,
    { issuer: "netmanager", audience: "pelanggan-portal", expiresIn },
  );
}

function request(path: string, cookie: string) {
  return new NextRequest(`https://pelanggan.radpro.id${path}`, {
    headers: { host: "pelanggan.radpro.id", cookie },
  });
}

describe("proxy — perpanjangan sesi pelanggan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = SECRET;
    palsu.getToken.mockResolvedValue(null);
  });

  it("access token habis + refresh token sah: halaman terbuka dan cookie baru dipasang", async () => {
    const baru = accessToken();
    palsu.refreshCustomerToken.mockResolvedValue({ accessToken: baru });
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      request("/tagihan", "customer-refresh-token=r1"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("customer-token")?.value).toBe(baru);
  });

  it("panggilan API ikut membawa access token baru ke handler", async () => {
    const baru = accessToken();
    palsu.refreshCustomerToken.mockResolvedValue({ accessToken: baru });
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      request(
        "/api/customer/invoices",
        `customer-token=${accessToken(-10)}; customer-refresh-token=r1`,
      ),
    );

    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      `customer-token=${baru}`,
    );
    expect(response.cookies.get("customer-token")?.value).toBe(baru);
  });

  it("access token masih sah: tidak memperbarui", async () => {
    const { proxy } = await import("@/proxy");

    await proxy(
      request(
        "/tagihan",
        `customer-token=${accessToken()}; customer-refresh-token=r1`,
      ),
    );

    expect(palsu.refreshCustomerToken).not.toHaveBeenCalled();
  });

  it("refresh token tidak sah: tetap dialihkan ke /login", async () => {
    palsu.refreshCustomerToken.mockResolvedValue(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      request("/tagihan", "customer-refresh-token=palsu"),
    );

    expect(response.headers.get("location")).toBe(
      "https://pelanggan.radpro.id/login",
    );
  });
});
