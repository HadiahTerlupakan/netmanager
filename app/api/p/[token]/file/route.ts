import { NextRequest, NextResponse } from "next/server";
import { runAsSystemContext } from "@/lib/tenant-context";
import { checkRateLimit } from "../rate-limit";
import { EndorsementService, isValidTokenFormat } from "@/modules/endorsement";

/**
 * GET /api/p/[token]/file — alirkan dokumen kepada pemegang tautan.
 *
 * Berkas tidak pernah disajikan lewat URL penyimpanan supaya aksesnya berhenti
 * saat surat dibatalkan atau kedaluwarsa. Setelah surat sah, yang ditampilkan
 * adalah PDF gabungan.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  if (!isValidTokenFormat(token)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const limited = await checkRateLimit(request, token);
  if (limited) return limited;

  const file = await runAsSystemContext(
    "endorsement: unduh dokumen pihak luar",
    async () => {
      const service = new EndorsementService();
      try {
        const { endorsement } = await service.resolveByToken(token);
        const key = endorsement.signedFileKey ?? endorsement.sourceFileKey;

        return {
          buffer: await service.readFile(key),
          name: endorsement.sourceFileName,
        };
      } catch {
        return null;
      }
    },
    { silent: true },
  );

  if (!file) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${file.name}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
}
