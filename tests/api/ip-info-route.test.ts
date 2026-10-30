import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn(async () => []),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from "@/app/api/ip-info/route";

const call = (ip: string) =>
  GET(
    new NextRequest(
      `http://localhost/api/ip-info?ip=${encodeURIComponent(ip)}`,
    ),
    { params: Promise.resolve({}) } as never,
  );

const loggedIn = (permissions: string[]) =>
  mocks.getServerSession.mockResolvedValue({
    user: { id: "u1", email: "a@b.c", tenantId: "t1", permissions },
  });

describe("GET /api/ip-info", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects callers without a session and never reaches ip-api", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const res = await call("8.8.8.8");

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects users who cannot read registrations", async () => {
    loggedIn(["pelanggan:read"]);

    const res = await call("8.8.8.8");

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["8.8.8.8/../batch", "8.8.8.8?fields=all#", "example.com", ""])(
    "rejects %j, which is not an IP address",
    async (ip) => {
      loggedIn(["registration:read"]);

      const res = await call(ip);

      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("looks up a public IP for a user who can read registrations", async () => {
    loggedIn(["registration:read"]);
    fetchMock.mockResolvedValue({
      json: async () => ({
        status: "success",
        query: "8.8.4.4",
        country: "United States",
        countryCode: "US",
        city: "Ashburn",
        isp: "Google LLC",
      }),
    });

    const res = await call("8.8.4.4");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/ip-api\.com\/json\/8\.8\.4\.4\?/),
    );
  });
});
