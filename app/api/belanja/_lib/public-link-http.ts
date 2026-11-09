import { NextResponse } from "next/server";

import { readClientInfo } from "@/lib/activity-request-context";
import { hasPermission } from "@/lib/rbac";
import { hashLinkToken } from "@/lib/security/link-token";
import { checkRateLimit } from "@/lib/redis";
import { readBodyWithLimit } from "@/lib/upload/read-body-with-limit";
import { PURCHASE_LINK_MESSAGES } from "@/modules/inventory";
import {
  MAX_PUBLIC_PURCHASE_BODY_BYTES,
  publicPurchaseTokenSchema,
} from "@/lib/validations/restock";

/**
 * Bagian HTTP bersama untuk API link belanja tanpa login: header keamanan,
 * pembacaan body terbatas, rate limit berbasis sidik jari token, dan satu
 * respons generik untuk semua link yang tidak berlaku.
 *
 * Token tidak pernah ditulis ke log maupun ke kunci rate limit (kunci rate
 * limit dicetak ke log saat batas terlampaui), hanya potongan hash-nya.
 */

/**
 * Route ini tidak lewat proxy.ts (lihat matcher-nya), jadi semua header
 * keamanan respons dipasang di sini.
 */
export const PUBLIC_LINK_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
} as const;

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_RETRY_AFTER = String(RATE_LIMIT_WINDOW_SECONDS);
/** Panjang potongan hash token di kunci rate limit (128 bit). */
const RATE_LIMIT_HASH_PREFIX_LENGTH = 32;
const JSON_CONTENT_TYPE = "application/json";
/** Kunci IP bila proxy tidak memberi alamat (hanya terjadi di luar cluster). */
const UNKNOWN_IP_KEY = "unknown";
/** Izin yang wajib masih dimiliki pembuat link agar link tetap berlaku. */
const LINK_CREATOR_PERMISSION = "restock:verify";

export const PUBLIC_LINK_ERRORS = {
  LINK_INACTIVE: { status: 404, error: "Link ini sudah tidak berlaku." },
  UNSUPPORTED: { status: 415, error: "Permintaan tidak dikenali." },
  TOO_LARGE: {
    status: 413,
    error: "Isian terlalu besar. Hapus tanda tangan, lalu tanda tangan ulang.",
  },
  RATE_LIMITED: {
    status: 429,
    error: "Terlalu sering dicoba. Tunggu sebentar, lalu coba lagi.",
  },
  STORAGE_UNAVAILABLE: {
    status: 503,
    error:
      "Tanda tangan belum bisa disimpan sekarang. Coba lagi nanti atau hubungi admin gudang.",
  },
  INTERNAL_ERROR: {
    status: 500,
    error: "Ada gangguan. Isian Anda masih ada, coba kirim lagi.",
  },
  VALIDATION_ERROR: {
    status: 400,
    error: "Isian tidak terbaca. Muat ulang halaman, lalu coba lagi.",
  },
  CONFLICT: { status: 409, error: PURCHASE_LINK_MESSAGES.conflict },
} as const;

export type PublicLinkErrorCode = keyof typeof PUBLIC_LINK_ERRORS;

/**
 * Batas permintaan per menit untuk satu endpoint publik. `isFailClosed`
 * menolak permintaan saat Redis bermasalah (dipakai endpoint yang menulis
 * dan mengunggah tanda tangan).
 */
export interface PublicLinkRateLimits {
  scope: string;
  perIp: number;
  perLink: number;
  isFailClosed: boolean;
}

/** Respons JSON dengan header keamanan link publik. */
export function publicJson(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...PUBLIC_LINK_HEADERS, ...extraHeaders },
  });
}

/** Respons galat publik; pesan bawaannya bisa diganti (mis. galat isian). */
export function publicError(
  code: PublicLinkErrorCode,
  message?: string,
): NextResponse {
  const { status, error: defaultMessage } = PUBLIC_LINK_ERRORS[code];
  const error = message ?? defaultMessage;
  const extra: Record<string, string> =
    code === "RATE_LIMITED" ? { "Retry-After": RATE_LIMIT_RETRY_AFTER } : {};
  return publicJson({ success: false, error, code }, status, extra);
}

/** Satu respons yang sama untuk semua alasan link tidak berlaku. */
export function linkInactiveResponse(): NextResponse {
  return publicError("LINK_INACTIVE");
}

export type ParsedPublicBody =
  | { ok: true; body: unknown; token: string }
  | { ok: false; response: NextResponse };

/**
 * True bila `Content-Length` menyebut ukuran di atas batas. Body chunked
 * tanpa `Content-Length` tetap dibatasi saat dibaca (`readBodyWithLimit`).
 */
export function isDeclaredBodyTooLarge(
  request: Request,
  maxBytes: number,
): boolean {
  const declared = request.headers.get("content-length");
  if (declared === null) return false;
  const size = Number(declared);
  return !Number.isFinite(size) || size > maxBytes;
}

/**
 * Periksa content-type, tolak dini bila `Content-Length` di atas 320 KB,
 * baca body maksimal 320 KB (berhenti di batas untuk body chunked), parse
 * JSON, lalu ambil token. Token yang bentuknya salah langsung dijawab 404
 * generik.
 */
export async function readPublicLinkBody(
  request: Request,
): Promise<ParsedPublicBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith(JSON_CONTENT_TYPE)) {
    return { ok: false, response: publicError("UNSUPPORTED") };
  }
  if (isDeclaredBodyTooLarge(request, MAX_PUBLIC_PURCHASE_BODY_BYTES)) {
    return { ok: false, response: publicError("TOO_LARGE") };
  }

  const raw = await readBodyWithLimit(request, MAX_PUBLIC_PURCHASE_BODY_BYTES);
  if (raw === null) return { ok: false, response: publicError("TOO_LARGE") };

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { ok: false, response: publicError("VALIDATION_ERROR") };
  }

  const token = publicPurchaseTokenSchema.safeParse(body);
  if (!token.success) return { ok: false, response: linkInactiveResponse() };
  return { ok: true, body, token: token.data.token };
}

/**
 * IP klien yang bisa dipercaya: `X-Real-Ip` dari Traefik atau entri terakhir
 * `X-Forwarded-For`. Entri pertama bisa diisi sendiri oleh klien, jadi tidak
 * dipakai (lihat `readClientInfo`).
 */
function getTrustedClientIp(request: Request): string | null {
  return readClientInfo(request.headers).ipAddress;
}

async function isWithinLimit(
  key: string,
  limit: number,
  limits: PublicLinkRateLimits,
): Promise<boolean> {
  return checkRateLimit(key, limit, RATE_LIMIT_WINDOW_SECONDS, {
    tenantId: null,
    failClosed: limits.isFailClosed,
  });
}

/**
 * Rate limit per IP; dijalankan sebelum body dibaca supaya permintaan
 * dengan body besar, JSON rusak, atau token salah bentuk ikut terhitung.
 * Null bila boleh lanjut.
 */
export async function enforcePublicIpRateLimit(
  request: Request,
  limits: PublicLinkRateLimits,
): Promise<NextResponse | null> {
  const ip = getTrustedClientIp(request) ?? UNKNOWN_IP_KEY;
  const isAllowed = await isWithinLimit(
    `${limits.scope}:ip:${ip}`,
    limits.perIp,
    limits,
  );
  return isAllowed ? null : publicError("RATE_LIMITED");
}

/** Rate limit per link (potongan hash token); null bila boleh lanjut. */
export async function enforcePublicLinkRateLimit(
  token: string,
  limits: PublicLinkRateLimits,
): Promise<NextResponse | null> {
  const linkKey = hashLinkToken(token).slice(0, RATE_LIMIT_HASH_PREFIX_LENGTH);
  const isAllowed = await isWithinLimit(
    `${limits.scope}:link:${linkKey}`,
    limits.perLink,
    limits,
  );
  return isAllowed ? null : publicError("RATE_LIMITED");
}

/**
 * Link hanya berlaku selama pembuatnya masih berhak membuat link belanja.
 * Link dari admin yang sudah kehilangan izin dianggap tidak berlaku.
 */
export async function isLinkCreatorAuthorized(
  createdById: string,
): Promise<boolean> {
  return hasPermission(
    LINK_CREATOR_PERMISSION,
    { id: createdById },
    { silent: true },
  );
}

/**
 * Urutan baku endpoint publik: batas per IP, baca body, lalu batas per link.
 * Semua jalur gagal sudah berupa respons siap kirim.
 */
export async function readRateLimitedPublicBody(
  request: Request,
  limits: PublicLinkRateLimits,
): Promise<ParsedPublicBody> {
  const ipLimited = await enforcePublicIpRateLimit(request, limits);
  if (ipLimited) return { ok: false, response: ipLimited };

  const parsed = await readPublicLinkBody(request);
  if (parsed.ok === false) return parsed;

  const linkLimited = await enforcePublicLinkRateLimit(parsed.token, limits);
  return linkLimited ? { ok: false, response: linkLimited } : parsed;
}

/** IP & user agent pengirim untuk audit; null bila tidak diketahui. */
export function getPublicClientInfo(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return readClientInfo(request.headers);
}
