import { timingSafeEqual } from "node:crypto";
import { isIPv4 } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { IsolirServicePageService } from "@/modules/network";

const BEARER_PREFIX = "Bearer ";

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
  const expected = process.env.ISOLIR_SERVICE_TOKEN;
  if (!expected) {
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
    if (req.headers.get("if-none-match") === etag) {
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
