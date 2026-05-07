/**
 * Cookie configuration untuk NextAuth
 * Mendukung cross-subdomain authentication
 */

const isProduction =
  process.env.NODE_ENV === "production" &&
  process.env.NEXTAUTH_URL?.startsWith("https://");

const cookieDomain =
  process.env.COOKIE_DOMAIN === "localhost"
    ? undefined
    : process.env.COOKIE_DOMAIN;

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: isProduction,
  domain: cookieDomain,
};

export const cookies = {
  sessionToken: {
    name: isProduction
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
    options: baseCookieOptions,
  },
  callbackUrl: {
    name: isProduction
      ? "__Secure-next-auth.callback-url"
      : "next-auth.callback-url",
    options: baseCookieOptions,
  },
  csrfToken: {
    name: isProduction ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
    options: {
      ...baseCookieOptions,
      ...(isProduction && { domain: undefined }),
    },
  },
};
