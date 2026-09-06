import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Login harus dilakukan dua kali karena cookie sesi bersifat host-only.
 *
 * Halaman login juga dilayani di apex (`radpro.id/admin/login`), dan tautan
 * "Login Admin" di landing page mengarah ke sana. Login di apex menaruh cookie
 * pada `radpro.id`, lalu aplikasi memindahkan pengguna ke `admin.radpro.id` —
 * host yang tidak punya cookie itu, sehingga `ensureAdminAccess` melempar balik
 * ke halaman login. Percobaan kedua terjadi di subdomain admin, dan barulah
 * cookie mendarat di host yang benar.
 *
 * `COOKIE_DOMAIN` membuat cookie berlaku lintas subdomain. Cookie CSRF sengaja
 * TIDAK ikut melebar: prefix `__Host-` melarang atribut Domain.
 */
const loadCookies = async () => {
  vi.resetModules();
  return (await import("@/lib/auth/cookies")).cookies;
};

const envAsli = { ...process.env };

// `NODE_ENV` bertipe read-only di definisi tipe Node; disetel lewat indeks
// agar tetap bisa diuji tanpa melonggarkan tipe secara global.
const setEnv = (key: string, value: string) => {
  (process.env as Record<string, string>)[key] = value;
};

beforeEach(() => {
  setEnv("NODE_ENV", "production");
  setEnv("NEXTAUTH_URL", "https://radpro.id");
});

afterEach(() => {
  process.env = { ...envAsli };
});

describe("konfigurasi cookie NextAuth", () => {
  it("membagikan cookie sesi ke seluruh subdomain saat COOKIE_DOMAIN diisi", async () => {
    setEnv("COOKIE_DOMAIN", ".radpro.id");

    const cookies = await loadCookies();

    expect(cookies.sessionToken.options.domain).toBe(".radpro.id");
  });

  // Tanpa nilai ini cookie host-only — inilah keadaan yang membuat login
  // di apex tidak terbawa ke subdomain admin.
  it("cookie sesi menjadi host-only saat COOKIE_DOMAIN kosong", async () => {
    delete process.env.COOKIE_DOMAIN;

    const cookies = await loadCookies();

    expect(cookies.sessionToken.options.domain).toBeUndefined();
  });

  // Prefix `__Host-` melarang atribut Domain; menyetelnya membuat browser
  // menolak cookie CSRF sepenuhnya dan login gagal total.
  it("tidak pernah menyetel domain pada cookie CSRF di produksi", async () => {
    setEnv("COOKIE_DOMAIN", ".radpro.id");

    const cookies = await loadCookies();

    expect(cookies.csrfToken.name).toBe("__Host-next-auth.csrf-token");
    expect(cookies.csrfToken.options.domain).toBeUndefined();
  });

  it("mengabaikan COOKIE_DOMAIN bernilai localhost", async () => {
    setEnv("COOKIE_DOMAIN", "localhost");

    const cookies = await loadCookies();

    expect(cookies.sessionToken.options.domain).toBeUndefined();
  });
});
