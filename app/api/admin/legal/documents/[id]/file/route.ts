import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { buildContentDisposition } from "@/lib/utils/content-disposition";
import { LegalDocumentService } from "@/modules/legal";
import { legalAccessFrom } from "../../../legal-route-helpers";

const documents = new LegalDocumentService();

/** GET /api/admin/legal/documents/[id]/file — berkas dialirkan lewat server, bukan URL publik. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (_request, ctx) => {
    const file = await documents.readFile(ctx.params.id as string, legalAccessFrom(ctx));

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "content-type": file.contentType,
        "content-disposition": buildContentDisposition(file.fileName),
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  },
);
