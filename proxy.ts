import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleCors, addCorsHeaders } from "./lib/middleware/cors";
import { getToken } from "next-auth/jwt";
import { isSuperAdmin } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";
  const pathname = url.pathname;

  // ----------------------------------------------------------------------------
  // 1. GLOBAL CORS HANDLING (For API Routes)
  // ----------------------------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    // Handle Preflight Request (OPTIONS)
    const corsResponse = handleCors(request);
    if (corsResponse) {
      return corsResponse;
    }
  }

  // ----------------------------------------------------------------------------
  // 2. SECURITY HEADERS SETUP
  // ----------------------------------------------------------------------------
  const responseHeaders = new Headers(request.headers);
  responseHeaders.set("X-Frame-Options", "DENY");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  responseHeaders.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' blob: data:; connect-src 'self' https: http: ws: wss: capacitor:; worker-src 'self' blob:;",
  ); // Added http: and capacitor: for mobile dev

  // ----------------------------------------------------------------------------
  // 3. SUBDOMAIN & REWRITE LOGIC
  // ----------------------------------------------------------------------------
  let subdomain = null;

  if (hostname.startsWith("admin.")) subdomain = "admin";
  if (hostname.startsWith("admin-staging.")) subdomain = "admin";
  if (hostname.startsWith("karyawan.")) subdomain = "karyawan";
  if (hostname.startsWith("karyawan-staging.")) subdomain = "karyawan";
  if (hostname.startsWith("investor.")) subdomain = "investor";
  if (hostname.startsWith("investor-staging.")) subdomain = "investor";
  if (hostname.startsWith("pelanggan.")) subdomain = "pelanggan";
  if (hostname.startsWith("pelanggan-staging.")) subdomain = "pelanggan";

  // SKIP Rewrite/Auth for: API, Next.js Internals, Static Files
  if (
    pathname === "/api/settings/backup/import" || // Bypass untuk upload besar (>10MB)
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // public files
  ) {
    // Pass through, but modify request headers for downstream
    const res = NextResponse.next({
      request: {
        headers: responseHeaders,
      },
    });

    // Add CORS headers for API responses
    if (pathname.startsWith("/api/")) {
      return addCorsHeaders(res, request);
    }

    // Add Security headers for non-API static/internal
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return res;
  }

  // ----------------------------------------------------------------------------
  // 4. AUTHENTICATION & ACCESS CONTROL (For Pages)
  // ----------------------------------------------------------------------------
  const token = await getToken({ req: request });

  // Redirect unauthorized access to Admin Subdomain
  if (subdomain === "admin") {
    if (!pathname.includes("/login")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      if (!token.accessAdminPanel && !isSuperAdmin(token)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "AccessDenied");
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Redirect unauthorized access to Employee Subdomain
  if (subdomain === "karyawan") {
    if (!pathname.includes("/login")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      if (!token.accessEmployeePanel && !isSuperAdmin(token)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "AccessDenied");
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Redirect unauthorized access to Customer Subdomain
  if (subdomain === "pelanggan") {
    if (!pathname.includes("/login")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      if (token.role !== "CUSTOMER" && !isSuperAdmin(token)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "AccessDenied");
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 5. REWRITE EXECUTION
  // ----------------------------------------------------------------------------
  let response: NextResponse;

  if (subdomain === "admin") {
    let rewritePath = pathname;
    if (!rewritePath.startsWith("/admin")) {
      rewritePath = `/admin${rewritePath}`;
    }
    const newUrl = new URL(rewritePath, request.url);
    newUrl.search = url.search;
    response = NextResponse.rewrite(newUrl);
  } else if (subdomain === "karyawan") {
    let rewritePath = pathname;
    if (!rewritePath.startsWith("/karyawan")) {
      rewritePath = `/karyawan${rewritePath}`;
    }
    const newUrl = new URL(rewritePath, request.url);
    newUrl.search = url.search;
    response = NextResponse.rewrite(newUrl);
  } else if (subdomain === "investor") {
    let rewritePath = pathname;
    if (!rewritePath.startsWith("/investor")) {
      rewritePath = `/investor${rewritePath}`;
    }
    const newUrl = new URL(rewritePath, request.url);
    newUrl.search = url.search;
    response = NextResponse.rewrite(newUrl);
  } else if (subdomain === "pelanggan") {
    let rewritePath = pathname;
    if (rewritePath === "/") {
      rewritePath = "/dashboard";
    }
    const newUrl = new URL(rewritePath, request.url);
    newUrl.search = url.search;
    response = NextResponse.rewrite(newUrl);
  } else {
    // Root domain logic
    // Protect direct access to /admin or /karyawan paths on root domain
    if (pathname.startsWith("/admin")) {
      if (
        !token?.accessAdminPanel &&
        !isSuperAdmin(token) &&
        !pathname.includes("/login")
      ) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }
    if (pathname.startsWith("/karyawan")) {
      if (
        !token?.accessEmployeePanel &&
        !isSuperAdmin(token) &&
        !pathname.includes("/login")
      ) {
        return NextResponse.redirect(new URL("/karyawan/login", request.url));
      }
    }
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/customer")) {
      if (
        token?.role !== "CUSTOMER" &&
        !isSuperAdmin(token) &&
        !pathname.includes("/login")
      ) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    response = NextResponse.next();
  }

  // Apply Security Headers to final response
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' blob: data:; connect-src 'self' https: http: ws: wss: capacitor:; worker-src 'self' blob:;",
  );

  return response;
}

export const config = {
  // Match ALL routes so we can handle API CORS and Page Rewrites in one place
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
