import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_LOGIN_REASON_DISMANTLED } from "./customer-login-reason";

const ACCESS_COOKIE = "customer-token";
const REFRESH_COOKIE = "customer-refresh-token";

/** Pasangan token baru hasil refresh di portal pelanggan. */
export interface RefreshedCustomerTokens {
  accessToken: string;
  refreshToken: string;
}

/** Hasil `refreshCustomerAccessToken`. */
export type CustomerSessionRefresh =
  | { kind: "refreshed"; tokens: RefreshedCustomerTokens }
  /** Sesi sah, tetapi pelanggan sudah berhenti berlangganan. */
  | { kind: "dismantled" }
  | null;

/**
 * Access token pelanggan berumur 15 menit, refresh token 7 hari, tetapi
 * tidak ada yang pernah memakai refresh token: pelanggan dikeluarkan dari
 * portal setiap 15 menit. Bila access token hilang atau kedaluwarsa dan
 * refresh token masih sah, kembalikan access token dan refresh token baru
 * (refresh token lama hanya bisa ditukar sekali); null bila tidak perlu atau
 * tidak bisa diperbarui.
 */
export async function refreshCustomerAccessToken(
  request: NextRequest,
): Promise<CustomerSessionRefresh> {
  if (!request.cookies.get(REFRESH_COOKIE)?.value) return null;

  // Import dinamis: lib/jwt dan lib/customer-auth memuat Prisma, yang tidak
  // perlu untuk request tanpa refresh token.
  const { verifyPelangganAccessToken } = await import("./jwt");
  const current = request.cookies.get(ACCESS_COOKIE)?.value;
  if (current && verifyPelangganAccessToken(current)) return null;

  const { refreshCustomerToken } = await import("./customer-auth");
  const refreshed = await refreshCustomerToken(request);
  if (!refreshed) return null;
  if (refreshed.kind === "dismantled") return refreshed;
  return {
    kind: "refreshed",
    tokens: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    },
  };
}

/**
 * Halaman, bukan API atau berkas statis. Panggilan API tidak dialihkan: klien
 * membaca 401-nya lalu membuka /login, dan permintaan itu yang dialihkan.
 */
function isPageRequest(pathname: string) {
  return (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next") &&
    !pathname.includes(".")
  );
}

/**
 * Pelanggan yang sesinya berakhir karena dismantle: halaman dialihkan ke
 * /login?reason=dismantled dengan cookie sesi dihapus, supaya halaman login
 * bisa menjelaskan alasannya. null untuk permintaan selain halaman.
 */
export function redirectDismantledCustomer(
  request: NextRequest,
): NextResponse | null {
  if (!isPageRequest(request.nextUrl.pathname)) return null;

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", CUSTOMER_LOGIN_REASON_DISMANTLED);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

/**
 * Salinan request yang membawa token baru untuk penangan berikutnya. Refresh
 * token ikut diganti supaya penangan tidak melihat token yang sudah diputar.
 */
export function withRefreshedCustomerTokens(
  request: NextRequest,
  tokens: RefreshedCustomerTokens,
): NextRequest {
  const cookies = request.cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name !== ACCESS_COOKIE && cookie.name !== REFRESH_COOKIE,
    )
    .map((cookie) => `${cookie.name}=${cookie.value}`);
  cookies.push(`${ACCESS_COOKIE}=${tokens.accessToken}`);
  cookies.push(`${REFRESH_COOKIE}=${tokens.refreshToken}`);

  const headers = new Headers(request.headers);
  headers.set("cookie", cookies.join("; "));
  return new NextRequest(request, { headers });
}

/** Simpan access token dan refresh token baru di browser pelanggan. */
export async function persistRefreshedCustomerTokens(
  response: NextResponse,
  tokens: RefreshedCustomerTokens,
) {
  const { setCustomerAuthCookies } = await import("./customer-auth");
  setCustomerAuthCookies(response, tokens.accessToken, tokens.refreshToken);
}
