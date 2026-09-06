import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi: logout tidak mengakhiri sesi.
 *
 * Setelah `COOKIE_DOMAIN=.radpro.id` aktif, browser yang pernah login sebelum
 * perubahan itu menyimpan dua cookie bernama sama: satu host-only (lama) dan
 * satu berlingkup domain (baru). NextAuth hanya menghapus yang berlingkup
 * domain, sehingga yang host-only tetap dikirim dan sesi tetap hidup.
 *
 * Terverifikasi di produksi: `POST /api/auth/signout` membalas 200 dengan
 * `set-cookie: __Secure-next-auth.session-token=; Max-Age=0; Domain=.radpro.id`,
 * lalu `/api/auth/session` masih mengembalikan pengguna yang sama.
 */

const SESSION_COOKIE = "__Secure-next-auth.session-token";

async function loadModule(cookieDomain?: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXTAUTH_URL", "https://radpro.id");
  vi.stubEnv("COOKIE_DOMAIN", cookieDomain ?? "");

  return import("@/lib/auth/host-only-cookies");
}

const setCookiesOf = (response: Response) => response.headers.getSetCookie();

const hostOnlyDeletionsOf = (response: Response) =>
  setCookiesOf(response).filter(
    (cookie) => cookie.includes("Max-Age=0") && !/;\s*Domain=/i.test(cookie),
  );

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("withHostOnlyCookieCleanup", () => {
  it("menghapus kembaran host-only saat NextAuth menghapus cookie sesi", async () => {
    const { withHostOnlyCookieCleanup } = await loadModule(".radpro.id");
    const signOutResponse = new Response(null, {
      status: 200,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=; Max-Age=0; Domain=.radpro.id; Path=/; HttpOnly; Secure; SameSite=Lax`,
      },
    });

    const patched = withHostOnlyCookieCleanup(signOutResponse);
    const deletions = hostOnlyDeletionsOf(patched);

    expect(deletions).toContain(
      `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  });

  // Token besar dipecah NextAuth menjadi `<nama>.0`, `<nama>.1`, dan seterusnya.
  // Jumlah pecahan cookie lama tidak selalu sama dengan yang baru, jadi sisa
  // pecahan host-only tetap harus tersapu.
  it("juga menghapus pecahan token host-only", async () => {
    const { withHostOnlyCookieCleanup } = await loadModule(".radpro.id");
    const response = new Response(null, {
      status: 200,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=; Max-Age=0; Domain=.radpro.id; Path=/`,
      },
    });

    const names = hostOnlyDeletionsOf(withHostOnlyCookieCleanup(response)).map(
      (cookie) => cookie.slice(0, cookie.indexOf("=")),
    );

    expect(names).toContain(`${SESSION_COOKIE}.0`);
    expect(names).toContain(`${SESSION_COOKIE}.1`);
  });

  // Login juga menulis cookie berlingkup domain. Kalau kembaran host-only-nya
  // dibiarkan, browser mengirim keduanya dan server membaca yang lama.
  it("membersihkan kembaran host-only saat cookie sesi baru ditulis", async () => {
    const { withHostOnlyCookieCleanup } = await loadModule(".radpro.id");
    const signInResponse = new Response(null, {
      status: 302,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=token-baru; Domain=.radpro.id; Path=/; HttpOnly; Secure; SameSite=Lax`,
      },
    });

    const patched = withHostOnlyCookieCleanup(signInResponse);

    expect(hostOnlyDeletionsOf(patched).length).toBeGreaterThan(0);
    // Cookie sesi yang baru tidak boleh ikut terhapus.
    expect(setCookiesOf(patched)).toContain(
      `${SESSION_COOKIE}=token-baru; Domain=.radpro.id; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  });

  // Cookie CSRF memang harus host-only (berawalan `__Host-`).
  it("tidak menyentuh cookie CSRF", async () => {
    const { withHostOnlyCookieCleanup } = await loadModule(".radpro.id");
    const response = new Response(null, {
      status: 200,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=; Max-Age=0; Domain=.radpro.id; Path=/`,
      },
    });

    const patched = withHostOnlyCookieCleanup(response);

    expect(
      setCookiesOf(patched).some((cookie) => cookie.startsWith("__Host-")),
    ).toBe(false);
  });

  it("tidak mengubah respons yang tidak menulis cookie auth", async () => {
    const { withHostOnlyCookieCleanup } = await loadModule(".radpro.id");
    const response = new Response('{"user":null}', { status: 200 });

    expect(withHostOnlyCookieCleanup(response)).toBe(response);
  });

  // Tanpa COOKIE_DOMAIN, cookie auth memang host-only dan satu-satunya.
  it("tidak melakukan apa-apa saat COOKIE_DOMAIN tidak diset", async () => {
    const { withHostOnlyCookieCleanup } = await loadModule(undefined);
    const response = new Response(null, {
      status: 200,
      headers: {
        "set-cookie": `${SESSION_COOKIE}=; Max-Age=0; Domain=.radpro.id; Path=/`,
      },
    });

    expect(withHostOnlyCookieCleanup(response)).toBe(response);
  });
});
