import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

/**
 * Regresi: penjaga portal pelanggan hanya membaca sesi NextAuth staf, padahal
 * login portal memasang JWT pelanggan di cookie `customer-token`. Di produksi
 * TES LAB 02 login berhasil (200 "Login berhasil") lalu /dashboard selalu
 * dialihkan kembali ke /login; portal hanya terbuka bila browser kebetulan
 * masih membawa sesi admin.
 */

const mockGetToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

const SECRET = "test-secret";

function customerToken(secret = SECRET) {
  return jwt.sign(
    {
      id: "pel-1",
      idPelanggan: "67863587",
      nama: "TES LAB 02",
      status: "AKTIF",
    },
    secret,
    { issuer: "netmanager", audience: "pelanggan-portal", expiresIn: "15m" },
  );
}

function portalRequest(url: string, cookie?: string) {
  const host = new URL(url).host;
  return new NextRequest(url, {
    headers: {
      host,
      ...(cookie ? { cookie: `customer-token=${cookie}` } : {}),
    },
  });
}

describe("proxy — portal pelanggan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = SECRET;
    mockGetToken.mockResolvedValue(null);
  });

  it("membuka /dashboard untuk pelanggan dengan JWT pelanggan yang sah", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      portalRequest("https://pelanggan.radpro.id/dashboard", customerToken()),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/dashboard",
    );
  });

  it("mengalihkan ke /login tanpa cookie pelanggan", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      portalRequest("https://pelanggan.radpro.id/dashboard"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://pelanggan.radpro.id/login",
    );
  });

  it("mengalihkan ke /login bila JWT pelanggan palsu", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      portalRequest(
        "https://pelanggan.radpro.id/tagihan",
        customerToken("kunci-lain"),
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://pelanggan.radpro.id/login",
    );
  });

  it("membuka /dashboard di subdomain tenant untuk pelanggan yang sah", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      portalRequest("https://isp-satu.radpro.id/dashboard", customerToken()),
    );

    expect(response.headers.get("location")).toBeNull();
  });
});
