import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { config } from "@/proxy";

/**
 * proxy.ts menangkap semua rute kecuali aset statis Next, favicon, dan upload
 * backup. Upload backup dikecualikan supaya body besar (>10 MB) tidak
 * ditampung proxy.
 */
function isMatchedByProxy(pathname: string): boolean {
  return config.matcher.some((pattern) =>
    new RegExp(`^${pattern}$`).test(pathname),
  );
}

describe("matcher proxy.ts", () => {
  it.each(["/api/inventory/restock/requests", "/admin/inventory/restock"])(
    "%s lewat proxy",
    (pathname) => {
      expect(isMatchedByProxy(pathname)).toBe(true);
    },
  );

  it("pengecualian upload backup tetap ada", () => {
    expect(isMatchedByProxy("/api/settings/backup/import")).toBe(false);
  });

  it.each(["/api/belanja/catat", "/api/belanja/daftar"])(
    "%s tidak lagi dikecualikan karena link belanja sudah dihapus",
    (pathname) => {
      expect(isMatchedByProxy(pathname)).toBe(true);
    },
  );
});
