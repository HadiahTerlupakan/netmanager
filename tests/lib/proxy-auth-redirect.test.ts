import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetToken = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

describe("proxy admin auth redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous admin subdomain users to /login without AccessDenied", async () => {
    mockGetToken.mockResolvedValueOnce(null);

    const { proxy } = await import("@/proxy");

    const request = new NextRequest(
      "https://admin-staging.radpro.id/dashboard",
      {
        headers: {
          host: "admin-staging.radpro.id",
        },
      },
    );

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://admin-staging.radpro.id/login",
    );
  });

  it("redirects authenticated non-admin users to /login with AccessDenied", async () => {
    mockGetToken.mockResolvedValueOnce({
      role: "USER",
      accessAdminPanel: false,
    });

    const { proxy } = await import("@/proxy");

    const request = new NextRequest(
      "https://admin-staging.radpro.id/dashboard",
      {
        headers: {
          host: "admin-staging.radpro.id",
        },
      },
    );

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://admin-staging.radpro.id/login?error=AccessDenied",
    );
  });

  it("allows Firebase Realtime Database dynamic script and frame hosts in CSP", async () => {
    mockGetToken.mockResolvedValueOnce({
      role: "ADMIN",
      accessAdminPanel: true,
    });

    const { proxy } = await import("@/proxy");

    const request = new NextRequest("https://admin-staging.radpro.id/admin", {
      headers: {
        host: "admin-staging.radpro.id",
      },
    });

    const response = await proxy(request);
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).toContain("https://*.asia-southeast1.firebasedatabase.app");
    expect(csp).toContain(
      "frame-src 'self' https://*.asia-southeast1.firebasedatabase.app",
    );
  });
});
