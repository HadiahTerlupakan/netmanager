import { timingSafeEqual } from "node:crypto";
import { isIPv4 } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { IsolirServicePageService } from "@/modules/network";

const BEARER_PREFIX = "Bearer ";
const MIN_TOKEN_LENGTH = 32;
const PLACEHOLDER_TOKEN = "REPLACE_WITH_REAL_SECRET_BEFORE_DEPLOY";
/**
 * Traefik selalu menambahkan X-Real-Ip pada permintaan dari ingress, sedangkan
 * klien Go netmanager-isolir di dalam cluster tidak mengirimnya. X-Forwarded-For
 * tidak bisa dipakai: server Next.js sendiri mengisinya dengan alamat soket
 * pada setiap permintaan (base-server.js), termasuk yang dari dalam cluster.
 */
const PROXY_HEADERS = ["x-real-ip", "forwarded"];

/** Route ini membaca env langsung, jadi aturan min(32) di lib/env.ts tidak berlaku di sini. */
function usableToken(value: string | undefined): string | null {
  if (
    !value ||
    value.length < MIN_TOKEN_LENGTH ||
    value === PLACEHOLDER_TOKEN
  ) {
    return null;
  }
  return value;
}

/** Ingress yang meng-gzip mengubah ETag kuat menjadi lemah (W/"..."). */
function stripWeakPrefix(value: string | null): string | null {
  return value?.startsWith("W/") ? value.slice(2) : value;
}

/** timingSafeEqual melempar bila panjang berbeda, jadi panjang dibandingkan dulu. */
function tokenMatches(header: string | null, expected: string): boolean {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return false;
  }
  const given = Buffer.from(header.slice(BEARER_PREFIX.length));
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/**
 * GET /api/internal/isolir/page?address=<alamat VPN router>
 * Dilindungi ISOLIR_SERVICE_TOKEN (tanpa sesi), dipanggil layanan netmanager-isolir.
 */
export async function GET(req: NextRequest) {
  // proxy.ts meloloskan /api* dari internet; route ini hanya untuk dalam cluster.
  if (PROXY_HEADERS.some((name) => req.headers.has(name))) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const expected = usableToken(process.env.ISOLIR_SERVICE_TOKEN);
  if (!expected) {
    logger.error(
      "ISOLIR_SERVICE_TOKEN belum diset atau tidak valid",
      undefined,
      {
        path: "/api/internal/isolir/page",
      },
    );
    return NextResponse.json(
      { error: "Layanan isolir belum dikonfigurasi" },
      { status: 503 },
    );
  }
  if (!tokenMatches(req.headers.get("authorization"), expected)) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!isIPv4(address)) {
    return NextResponse.json(
      { error: "Parameter address harus alamat IPv4" },
      { status: 400 },
    );
  }

  try {
    const { html, hash } = await new IsolirServicePageService().getPage(
      address,
    );
    const etag = `"${hash}"`;
    const headers = { ETag: etag, "Cache-Control": "no-store" };
    if (stripWeakPrefix(req.headers.get("if-none-match")) === etag) {
      return new NextResponse(null, { status: 304, headers });
    }
    return new NextResponse(html, {
      status: 200,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: unknown) {
    logger.error(
      "Error menyusun halaman isolir untuk layanan",
      error as Error,
      {
        path: "/api/internal/isolir/page",
        method: "GET",
      },
    );
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
