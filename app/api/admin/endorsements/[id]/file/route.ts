import { NextRequest, NextResponse } from "next/server";
import { createHandler, ApiErrors } from "@/lib/api";
import { EndorsementService } from "@/modules/endorsement";

const service = new EndorsementService();

/**
 * GET /api/admin/endorsements/[id]/file?jenis=sumber|pengesahan
 *
 * Berkas dialirkan lewat rute ini, bukan lewat URL publik penyimpanan: dokumen
 * pengesahan bersifat rahasia, sedangkan URL publik R2 bocor permanen dan tidak
 * bisa dicabut.
 */
export const GET = createHandler(
  { auth: true, permissions: ["pengesahan:read"] },
  async (request: NextRequest, ctx) => {
    const endorsement = await service.getById(ctx.params.id as string);
    const variant = new URL(request.url).searchParams.get("jenis") ?? "sumber";

    const key =
      variant === "pengesahan"
        ? endorsement.signedFileKey
        : endorsement.sourceFileKey;

    if (!key) {
      return ApiErrors.notFound("Berkas pengesahan belum tersedia");
    }

    const buffer = await service.readFile(key);
    const fileName =
      variant === "pengesahan"
        ? `${endorsement.number.replace(/\//g, "-")}-pengesahan.pdf`
        : endorsement.sourceFileName;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${fileName}"`,
        // Dokumen rahasia tidak boleh mengendap di cache bersama.
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  },
);
