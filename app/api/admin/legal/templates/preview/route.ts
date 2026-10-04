import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api";
import { LegalTemplateDocumentService, previewLegalTemplateSchema } from "@/modules/legal";

const templateDocuments = new LegalTemplateDocumentService();

/**
 * POST /api/admin/legal/templates/preview — PDF pratinjau dari isi blok yang
 * sedang diedit; tidak disimpan ke mana pun.
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["legal:create", "legal:update"],
    feature: "legal",
    schema: previewLegalTemplateSchema,
  },
  async (_request, ctx) => {
    const pdf = await templateDocuments.render(ctx.validated.content, ctx.validated.document);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline",
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  },
);
