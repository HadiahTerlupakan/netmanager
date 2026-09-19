import { describe, expect, it } from "vitest";

import { buildSessionWithPermissions } from "@/lib/api/build-session-with-permissions";
import { ensureSiteIdInScope } from "@/lib/api/guards";
import { checkSiteRestriction } from "@/lib/authorization/site-restriction";

/**
 * Bug yang diperbaiki: route berbasis `createHandler` mengoper `ctx.session`
 * apa adanya ke `checkSiteRestriction`. Sesi itu tidak memuat `permissions`
 * (createHandler menyimpannya terpisah di `ctx.permissions`), sehingga
 * `isRestricted` selalu false dan `<resource>:site_only` tidak pernah berlaku.
 * Cast `as never` di titik panggil menyembunyikannya dari tsc.
 */

const SESI_CREATE_HANDLER = {
  user: {
    id: "user-1",
    email: "operator@contoh.id",
    name: "Operator",
    role: "Helpdesk",
    tenantId: "tenant-1",
    siteId: "site-a",
    siteIds: ["site-a"],
    isSuperAdmin: false,
  },
};

describe("pembatasan site pada sesi createHandler", () => {
  it("tidak menggigit bila sesi dioper apa adanya (bentuk lama)", () => {
    const hasil = checkSiteRestriction(
      SESI_CREATE_HANDLER as never,
      "pelanggan",
    );

    expect(hasil.isRestricted).toBe(false);
  });

  it("menggigit setelah permissions dijembatani ke sesi", () => {
    const sesi = buildSessionWithPermissions(SESI_CREATE_HANDLER as never, [
      "pelanggan:read",
      "pelanggan:site_only",
    ]);

    const hasil = checkSiteRestriction(sesi, "pelanggan");

    expect(hasil.isRestricted).toBe(true);
    expect(hasil.siteIds).toEqual(["site-a"]);
  });

  it("tetap bebas untuk pemegang izin tanpa site_only", () => {
    const sesi = buildSessionWithPermissions(SESI_CREATE_HANDLER as never, [
      "pelanggan:read",
    ]);

    expect(checkSiteRestriction(sesi, "pelanggan").isRestricted).toBe(false);
  });

  it("super admin tidak pernah dibatasi", () => {
    const sesi = buildSessionWithPermissions(
      {
        user: { ...SESI_CREATE_HANDLER.user, isSuperAdmin: true },
      } as never,
      ["pelanggan:site_only"],
    );

    expect(checkSiteRestriction(sesi, "pelanggan").isRestricted).toBe(false);
  });
});

describe("guard scope mitra", () => {
  const user = { id: "user-1", tenantId: "tenant-1" };

  it("menolak site di luar scope saat pemegang izin dibatasi", () => {
    const hasil = ensureSiteIdInScope(
      { ...user, ...SESI_CREATE_HANDLER.user },
      ["mitra:site_only"],
      "site-lain",
    );

    expect(hasil.valid).toBe(false);
  });

  it("mengizinkan site yang memang ditugaskan", () => {
    const hasil = ensureSiteIdInScope(
      { ...user, ...SESI_CREATE_HANDLER.user },
      ["mitra:site_only"],
      "site-a",
    );

    expect(hasil.valid).toBe(true);
  });

  it("mengizinkan semua site bila tidak ada pembatasan", () => {
    const hasil = ensureSiteIdInScope(
      { ...user, ...SESI_CREATE_HANDLER.user },
      ["mitra:update"],
      "site-lain",
    );

    expect(hasil.valid).toBe(true);
  });
});
