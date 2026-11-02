import { describe, expect, it } from "vitest";

import { canAccessCanvasingSite } from "@/modules/marketing";

describe("canAccessCanvasingSite", () => {
  it("mengizinkan super admin tanpa melihat site", () => {
    expect(
      canAccessCanvasingSite({
        isSuperAdmin: true,
        permissions: ["canvasing:site_only"],
        session: { siteId: "site-x" },
        canvasing: { user: { siteId: "site-1" }, mitra: null },
      }),
    ).toBe(true);
  });

  it("mengizinkan user site_only jika site user canvasing sama", () => {
    expect(
      canAccessCanvasingSite({
        isSuperAdmin: false,
        permissions: ["canvasing:site_only"],
        session: { siteId: "site-1" },
        canvasing: { user: { siteId: "site-1" }, mitra: null },
      }),
    ).toBe(true);
  });

  it("menolak user site_only jika semua site berbeda", () => {
    expect(
      canAccessCanvasingSite({
        isSuperAdmin: false,
        permissions: ["canvasing:site_only"],
        session: { siteId: "site-x" },
        canvasing: {
          user: { siteId: "site-1" },
          mitra: { siteId: "site-2" },
        },
      }),
    ).toBe(false);
  });

  // Regresi: daftar memakai siteIds sementara detail/approve/reject hanya
  // siteId utama — canvasing di site tambahan tampil tetapi tidak bisa dibuka.
  it("memakai seluruh siteIds pengguna, sama seperti daftar", () => {
    expect(
      canAccessCanvasingSite({
        isSuperAdmin: false,
        permissions: ["canvasing:site_only"],
        session: { siteId: "site-x", siteIds: ["site-x", "site-2"] },
        canvasing: { user: { siteId: "site-2" }, mitra: null },
      }),
    ).toBe(true);
  });

  it("menolak user site_only tanpa site sama sekali", () => {
    expect(
      canAccessCanvasingSite({
        isSuperAdmin: false,
        permissions: ["canvasing:site_only"],
        session: { siteId: null, siteIds: [] },
        canvasing: { user: { siteId: null }, mitra: null },
      }),
    ).toBe(false);
  });
});
