import { NextRequest } from "next/server";

/**
 * Ekstrak IP client asli dari request headers.
 * Traefik sudah meneruskan X-Forwarded-For header.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For bisa berisi multiple IP: "client, proxy1, proxy2"
    // Ambil IP pertama (client asli)
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback jika tidak ada header (tidak akan terjadi di production)
  return "unknown";
}

/**
 * Ekstrak User-Agent dari request headers.
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}
