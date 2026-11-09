import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { config } from "@/proxy";

/**
 * API link belanja tanpa login tidak boleh lewat proxy.ts: bila lewat,
 * Next menampung body sampai `proxyClientMaxBodySize` (1 GB) sebelum
 * handler jalan, sehingga batas 320 KB di route tidak efektif.
 */
function isMatchedByProxy(pathname: string): boolean {
  return config.matcher.some((pattern) =>
    new RegExp(`^${pattern}$`).test(pathname),
  );
}

describe("matcher proxy.ts", () => {
  it.each(["/api/belanja/catat", "/api/belanja/daftar"])(
    "%s tidak lewat proxy",
    (pathname) => {
      expect(isMatchedByProxy(pathname)).toBe(false);
    },
  );

  it.each([
    "/belanja",
    "/api/inventory/restock/requests",
    "/api/belanja-lain",
    "/admin/inventory/restock",
  ])("%s tetap lewat proxy", (pathname) => {
    expect(isMatchedByProxy(pathname)).toBe(true);
  });

  it("pengecualian upload backup tetap ada", () => {
    expect(isMatchedByProxy("/api/settings/backup/import")).toBe(false);
  });
});
