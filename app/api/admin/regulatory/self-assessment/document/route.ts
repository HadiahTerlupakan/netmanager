import { NextResponse } from "next/server";
import { createHandler, requireSessionTenantId } from "@/lib/api";
import { parseQuery } from "@/lib/api/query-parser";
import { buildContentDisposition } from "@/lib/utils/content-disposition";
import { SelfAssessmentDocumentService, selfAssessmentQuerySchema } from "@/modules/regulatory";

export const dynamic = "force-dynamic";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const documents = new SelfAssessmentDocumentService();

/** GET /api/admin/regulatory/self-assessment/document?year= — dokumen Word Komdigi terisi. */
export const GET = createHandler(
  { auth: true, permissions: ["regulasi:read"] },
  async (request, ctx) => {
    const { year } = selfAssessmentQuerySchema.parse(parseQuery(new URL(request.url).searchParams));
    const document = await documents.renderDocument(year, requireSessionTenantId(ctx));

    return new NextResponse(new Uint8Array(document), {
      headers: {
        "content-type": DOCX_CONTENT_TYPE,
        "content-disposition": buildContentDisposition(`pelaporan-self-assessment-komdigi-${year}.docx`),
        "cache-control": "private, no-store",
      },
    });
  },
);
