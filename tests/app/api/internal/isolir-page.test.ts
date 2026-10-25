import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/modules/network", () => ({
  IsolirServicePageService: class {
    getPage = mocks.getPage;
  },
}));

import { GET } from "@/app/api/internal/isolir/page/route";

const TOKEN = "t".repeat(40);

function call(
  address: string | null,
  headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` },
) {
  const query =
    address === null ? "" : `?address=${encodeURIComponent(address)}`;
  return GET(
    new NextRequest(`http://localhost/api/internal/isolir/page${query}`, {
      headers,
    }),
  );
}

describe("GET /api/internal/isolir/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ISOLIR_SERVICE_TOKEN", TOKEN);
    mocks.getPage.mockResolvedValue({
      html: "<html>ISP T</html>",
      hash: "abc",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["x-real-ip", "203.0.113.7"],
    ["forwarded", "for=203.0.113.7"],
  ])("404 untuk permintaan lewat ingress (header %s)", async (name, value) => {
    const res = await call("10.100.0.4", {
      authorization: `Bearer ${TOKEN}`,
      [name]: value,
    });
    expect(res.status).toBe(404);
    expect(mocks.getPage).not.toHaveBeenCalled();
  });

  it("tetap melayani saat hanya ada X-Forwarded-For yang diisi Next.js", async () => {
    const res = await call("10.100.0.4", {
      authorization: `Bearer ${TOKEN}`,
      "x-forwarded-for": "10.42.0.17",
    });
    expect(res.status).toBe(200);
  });

  it.each(["pendek-10ch", "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY"])(
    "503 untuk token terkonfigurasi yang tidak layak: %s",
    async (configured) => {
      vi.stubEnv("ISOLIR_SERVICE_TOKEN", configured);
      const res = await call("10.100.0.4", {
        authorization: `Bearer ${configured}`,
      });
      expect(res.status).toBe(503);
      expect(mocks.getPage).not.toHaveBeenCalled();
    },
  );

  it("304 saat If-None-Match berupa ETag lemah", async () => {
    const res = await call("10.100.0.4", {
      authorization: `Bearer ${TOKEN}`,
      "if-none-match": 'W/"abc"',
    });
    expect(res.status).toBe(304);
  });

  it("401 tanpa header Authorization", async () => {
    expect((await call("10.100.0.4", {})).status).toBe(401);
  });

  it("401 untuk token salah", async () => {
    const res = await call("10.100.0.4", {
      authorization: `Bearer ${"x".repeat(40)}`,
    });
    expect(res.status).toBe(401);
  });

  it("401, bukan exception, untuk token dengan panjang berbeda", async () => {
    const res = await call("10.100.0.4", { authorization: "Bearer pendek" });
    expect(res.status).toBe(401);
  });

  it("503 saat ISOLIR_SERVICE_TOKEN tidak diset", async () => {
    vi.stubEnv("ISOLIR_SERVICE_TOKEN", "");
    const res = await call("10.100.0.4", { authorization: "Bearer " });
    expect(res.status).toBe(503);
    expect(mocks.getPage).not.toHaveBeenCalled();
  });

  it.each([null, "", "::1", "abc", "10.100.0.300"])(
    "400 untuk address %j",
    async (address) => {
      expect((await call(address)).status).toBe(400);
      expect(mocks.getPage).not.toHaveBeenCalled();
    },
  );

  it("200 membawa HTML, ETag berkutip, dan no-store", async () => {
    const res = await call("10.100.0.4");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("etag")).toBe('"abc"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("<html>ISP T</html>");
    expect(mocks.getPage).toHaveBeenCalledWith("10.100.0.4");
  });

  it("304 tanpa body saat If-None-Match sama", async () => {
    const res = await call("10.100.0.4", {
      authorization: `Bearer ${TOKEN}`,
      "if-none-match": '"abc"',
    });

    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe('"abc"');
    expect(await res.text()).toBe("");
  });

  it("200 saat If-None-Match berbeda", async () => {
    const res = await call("10.100.0.4", {
      authorization: `Bearer ${TOKEN}`,
      "if-none-match": '"lama"',
    });
    expect(res.status).toBe(200);
  });
});
