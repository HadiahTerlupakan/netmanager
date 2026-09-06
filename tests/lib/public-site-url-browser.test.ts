// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicSiteUrl } from "@/lib/utils/portal-url";
import { getAdminPortalUrl } from "@/lib/utils/portal-url";

/**
 * Regresi: klik "Masuk" di landing tetap berakhir di apex meski `href` yang
 * dirender server sudah absolut ke host portal.
 *
 * `NEXT_PUBLIC_*` disisipkan saat image dibangun, dan build ini tidak menerima
 * `NEXT_PUBLIC_APP_URL` sebagai build arg (`Dockerfile` hanya mendaftarkan ARG
 * untuk Firebase & VAPID). Server membacanya dari configmap saat runtime, jadi
 * HTML hasil render punya URL absolut — tetapi di bundel klien nilainya
 * undefined, sehingga komponen menyimpulkan tautannya internal, memakai
 * `next/link`, dan mencegat kliknya. Terverifikasi di produksi: `href` anchor
 * `https://admin.radpro.id/login` tetapi klik menghasilkan `defaultPrevented`
 * dan permintaan `?_rsc=` ke apex.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

const withoutEnvUrls = () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("NEXTAUTH_URL", "");
};

describe("getPublicSiteUrl di browser", () => {
  it("memakai origin halaman saat env tidak tersedia di bundel klien", () => {
    withoutEnvUrls();

    expect(getPublicSiteUrl()).toBe(window.location.origin);
  });

  it("tetap mengutamakan env saat tersedia", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://radpro.id");

    expect(getPublicSiteUrl()).toBe("https://radpro.id");
  });
});

describe("getPublicSiteUrl dari host portal", () => {
  // Modal payment gateway dirender di `admin.<domain>`; URL webhook yang
  // disalin admin ke dashboard penyedia pembayaran harus memakai domain
  // publik, bukan host portal.
  it("memetakan origin host portal kembali ke situs publik", () => {
    withoutEnvUrls();
    const origin = "https://admin.radpro.id";
    vi.spyOn(window, "location", "get").mockReturnValue({
      origin,
    } as unknown as Location);

    expect(getPublicSiteUrl()).toBe("https://radpro.id");

    vi.restoreAllMocks();
  });
});

describe("getAdminPortalUrl di browser", () => {
  // Inti regresi: hasilnya harus absolut agar komponen memilih anchor biasa,
  // bukan next/link yang mencegat klik dan membuang host-nya.
  it("menghasilkan URL absolut ke host portal dari origin halaman", () => {
    withoutEnvUrls();

    const url = new URL(getAdminPortalUrl());

    expect(url.protocol).toMatch(/^https?:$/);
    expect(url.pathname).toBe("/login");
    expect(url.hostname.startsWith("admin.")).toBe(true);
  });
});
