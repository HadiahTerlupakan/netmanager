import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { runAsSystemContext } from "@/lib/tenant-context";
import { buildContentDisposition } from "@/lib/utils/content-disposition";
import { checkRateLimit } from "../rate-limit";
import { EndorsementService, isValidTokenFormat } from "@/modules/endorsement";

/**
 * GET /api/p/[token]/file — alirkan dokumen kepada pemegang tautan.
 *
 * Berkas tidak pernah disajikan lewat URL penyimpanan supaya aksesnya berhenti
 * saat surat dibatalkan atau kedaluwarsa (ditegakkan service). Setelah surat
 * sah, yang ditampilkan adalah PDF gabungan.
 */
const notFound = () => new NextResponse("Not Found", { status: 404 });

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  if (!isValidTokenFormat(token)) return notFound();

  const limited = await checkRateLimit(request, token);
  if (limited) return limited;

  try {
    const file = await runAsSystemContext(
      "endorsement: unduh dokumen pihak luar",
      () => new EndorsementService().getDocumentForSigner(token),
      { silent: true },
    );

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": buildContentDisposition(file.fileName),
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    // Token asing, surat gugur, atau berkas hilang: semuanya 404 tanpa detail.
    if (error instanceof AppError && error.statusCode === 404) return notFound();
    throw error;
  }
}
