import { NextRequest, type NextResponse } from "next/server";

const ACCESS_COOKIE = "customer-token";
const REFRESH_COOKIE = "customer-refresh-token";

/**
 * Access token pelanggan berumur 15 menit, refresh token 7 hari, tetapi
 * tidak ada yang pernah memakai refresh token: pelanggan dikeluarkan dari
 * portal setiap 15 menit. Bila access token hilang atau kedaluwarsa dan
 * refresh token masih sah, kembalikan access token baru; null bila tidak
 * perlu atau tidak bisa diperbarui.
 */
export async function refreshCustomerAccessToken(
  request: NextRequest,
): Promise<string | null> {
  if (!request.cookies.get(REFRESH_COOKIE)?.value) return null;

  // Import dinamis: lib/jwt dan lib/customer-auth memuat Prisma, yang tidak
  // perlu untuk request tanpa refresh token.
  const { verifyPelangganAccessToken } = await import("./jwt");
  const current = request.cookies.get(ACCESS_COOKIE)?.value;
  if (current && verifyPelangganAccessToken(current)) return null;

  const { refreshCustomerToken } = await import("./customer-auth");
  const refreshed = await refreshCustomerToken(request);
  return refreshed?.accessToken ?? null;
}

/** Salinan request yang membawa access token baru untuk penangan berikutnya. */
export function withCustomerAccessToken(
  request: NextRequest,
  accessToken: string,
): NextRequest {
  const cookies = request.cookies
    .getAll()
    .filter((cookie) => cookie.name !== ACCESS_COOKIE)
    .map((cookie) => `${cookie.name}=${cookie.value}`);
  cookies.push(`${ACCESS_COOKIE}=${accessToken}`);

  const headers = new Headers(request.headers);
  headers.set("cookie", cookies.join("; "));
  return new NextRequest(request, { headers });
}

/** Simpan access token baru di browser pelanggan. */
export async function persistCustomerAccessToken(
  response: NextResponse,
  accessToken: string,
) {
  const { setCustomerAuthCookies } = await import("./customer-auth");
  setCustomerAuthCookies(response, accessToken);
}
