import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { buildContentDisposition } from "@/lib/utils/content-disposition";
import { EndorsementInboxService } from "@/modules/endorsement";

const inbox = new EndorsementInboxService();

/**
 * GET /api/mobile/pengesahan/[id]/file — PDF surat untuk penanda tangannya;
 * PDF gabungan setelah sah. Dialirkan lewat server, bukan URL penyimpanan.
 */
export const GET = createHandler({ auth: true }, async (_request, ctx) => {
  const file = await inbox.document(
    ctx.params.id as string,
    ctx.session!.user.id,
  );

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": buildContentDisposition(file.fileName),
      "cache-control": "private, no-store",
    },
  });
});
