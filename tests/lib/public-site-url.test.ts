import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicSiteUrl } from "@/lib/utils/portal-url";

/**
 * Subdomain portal tidak punya landing page: `proxy.ts` menulis ulang setiap
 * path di `admin.<domain>` ke `/admin/*` dan mengalihkan tamu ke `/login`.
 * Terverifikasi di produksi: `/`, `/harga`, dan `/status` di `admin.radpro.id`
 * sama-sama membalas `307 → /login`. Tautan kembali ke beranda karena itu harus
 * absolut ke apex, bukan relatif.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPublicSiteUrl", () => {
  it("memakai NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://radpro.id");

    expect(getPublicSiteUrl()).toBe("https://radpro.id");
  });

  it("membuang garis miring di akhir", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://radpro.id/");

    expect(getPublicSiteUrl()).toBe("https://radpro.id");
  });

  it("jatuh ke NEXTAUTH_URL saat NEXT_PUBLIC_APP_URL kosong", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "https://radpro.id");

    expect(getPublicSiteUrl()).toBe("https://radpro.id");
  });

  // Berbeda dari getAppUrl(), helper ini hanya untuk menampilkan tautan —
  // halaman login tidak boleh gagal render hanya karena env belum diisi.
  it("memakai path relatif saat env tidak diset, bukan melempar error", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");

    expect(getPublicSiteUrl()).toBe("/");
  });
});
