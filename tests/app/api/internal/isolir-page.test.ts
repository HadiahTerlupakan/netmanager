import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
