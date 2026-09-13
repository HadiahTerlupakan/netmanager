import { NextRequest, NextResponse } from "next/server";
import { getLogoSettings, getTrimmedLogo } from "@/modules/settings";
import type { LogoType } from "@/modules/settings";

const VALID_TYPES: LogoType[] = ["invoice", "aplikasi", "landing"];
const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

function parseLogoType(value: string): LogoType | null {
  return VALID_TYPES.includes(value as LogoType) ? (value as LogoType) : null;
}

/**
 * GET /api/settings/logo/trimmed/[type]
 *
 * Menyajikan logo tersimpan tanpa bingkai kosongnya. Berkas sumber tidak
 * diubah — pemangkasan hanya terjadi saat penyajian dan hasilnya di-cache.
 *
 * Bila logo tidak bisa dipangkas (format tak terbaca, sumber tidak terjangkau),
 * permintaan dialihkan ke berkas asli supaya logo tetap tampil.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  const { type } = await context.params;
  const logoType = parseLogoType(type);
  if (!logoType) {
    return NextResponse.json(
      { error: "Tipe logo tidak dikenal" },
      { status: 400 },
    );
  }

  const trimmed = await getTrimmedLogo(logoType);
  if (trimmed) {
    return new NextResponse(new Uint8Array(trimmed.data), {
      headers: {
        "Content-Type": trimmed.contentType,
        "Cache-Control": CACHE_CONTROL,
        ETag: trimmed.etag,
      },
    });
  }

  const settings = await getLogoSettings();
  const fallbackByType: Record<LogoType, string | null> = {
    invoice: settings.logoInvoice,
    aplikasi: settings.logoAplikasi,
    landing: settings.logoLandingPage,
  };
  const fallbackUrl = fallbackByType[logoType];

  if (!fallbackUrl) {
    return NextResponse.json({ error: "Logo belum diatur" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(fallbackUrl, _request.url), 307);
}
