import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminPortalHostname,
  getAdminPortalUrl,
  resolveAdminPortalHref,
} from "@/lib/utils/portal-url";

/**
 * Landing page berjalan di apex, sedangkan portal admin punya host sendiri.
 * `proxy.ts` menambahkan prefix `/admin` untuk setiap path di host itu, jadi
 * alamat kanoniknya `https://admin.<domain>/login`. Tautan lama
 * `/admin/login` membuat pengguna login di apex — bukan di host portalnya.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

const withPublicSite = (url: string) => vi.stubEnv("NEXT_PUBLIC_APP_URL", url);

describe("buildAdminPortalHostname", () => {
  it("menambahkan subdomain admin pada apex", () => {
    expect(buildAdminPortalHostname("radpro.id")).toBe("admin.radpro.id");
  });

  it("tidak menumpuk subdomain bila sudah di host admin", () => {
    expect(buildAdminPortalHostname("admin.radpro.id")).toBe("admin.radpro.id");
  });

  // Sertifikat wildcard hanya menutup satu tingkat subdomain, jadi staging
  // memakai satu label gabungan — sama seperti yang dikenali `proxy.ts`.
  it("memakai satu label gabungan untuk staging", () => {
    expect(buildAdminPortalHostname("staging.radpro.id")).toBe(
      "admin-staging.radpro.id",
    );
  });

  it("memetakan localhost ke admin.localhost", () => {
    expect(buildAdminPortalHostname("localhost")).toBe("admin.localhost");
  });
});

describe("getAdminPortalUrl", () => {
  it("default ke halaman login portal admin", () => {
    withPublicSite("https://radpro.id");

    expect(getAdminPortalUrl()).toBe("https://admin.radpro.id/login");
  });

  it("mempertahankan port pada pengembangan lokal", () => {
    withPublicSite("http://localhost:3000");

    expect(getAdminPortalUrl()).toBe("http://admin.localhost:3000/login");
  });

  // Tanpa env URL tidak ada host yang bisa diturunkan; tautan relatif tetap
  // bekerja di apex, jadi halaman tidak boleh berakhir dengan tautan rusak.
  it("jatuh ke path relatif saat env tidak diset", () => {
    withPublicSite("");
    vi.stubEnv("NEXTAUTH_URL", "");

    expect(getAdminPortalUrl()).toBe("/admin/login");
  });
});

describe("resolveAdminPortalHref", () => {
  it("mengalihkan tautan /admin/login ke host portal", () => {
    withPublicSite("https://radpro.id");

    expect(resolveAdminPortalHref("/admin/login")).toBe(
      "https://admin.radpro.id/login",
    );
  });

  it("mengalihkan /admin ke akar host portal", () => {
    withPublicSite("https://radpro.id");

    expect(resolveAdminPortalHref("/admin")).toBe("https://admin.radpro.id/");
  });

  it("membiarkan tautan jangkar apa adanya", () => {
    withPublicSite("https://radpro.id");

    expect(resolveAdminPortalHref("#features")).toBe("#features");
  });

  it("membiarkan mailto apa adanya", () => {
    withPublicSite("https://radpro.id");

    expect(resolveAdminPortalHref("mailto:sales@radpro.id")).toBe(
      "mailto:sales@radpro.id",
    );
  });

  // Portal pelanggan punya halaman sendiri di apex; jangan ikut dialihkan.
  it("membiarkan tautan portal pelanggan apa adanya", () => {
    withPublicSite("https://radpro.id");

    expect(resolveAdminPortalHref("/login")).toBe("/login");
  });

  // Nama yang berawalan sama tidak boleh ikut terpetakan.
  it("tidak mengalihkan path yang hanya berawalan mirip", () => {
    withPublicSite("https://radpro.id");

    expect(resolveAdminPortalHref("/administrasi")).toBe("/administrasi");
  });
});
