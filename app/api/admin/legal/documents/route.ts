import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  createLegalDocumentSchema,
  LegalDocumentService,
  listLegalDocumentsSchema,
  toLegalDocumentDetail,
  toLegalDocumentListItem,
} from "@/modules/legal";
import {
  legalAccessFrom,
  readLegalPayload,
  readLegalUpload,
} from "../legal-route-helpers";

const documents = new LegalDocumentService();

/** GET /api/admin/legal/documents — daftar dokumen dengan filter jenis/kategori/status. */
export const GET = createHandler(
  { auth: true, permissions: ["legal:read"], feature: "legal" },
  async (request: NextRequest, ctx) => {
    const { searchParams } = new URL(request.url);
    const filters = listLegalDocumentsSchema.parse(
      Object.fromEntries(searchParams.entries()),
    );

    const result = await documents.list(filters, legalAccessFrom(ctx));
    const now = new Date();

    return apiSuccess({
      items: result.items.map((item) => toLegalDocumentListItem(item, now)),
      total: result.total,
      page: filters.page,
      limit: filters.limit,
    });
  },
);

/** POST /api/admin/legal/documents — catat dokumen baru (multipart: file + payload JSON). */
export const POST = createHandler(
  { auth: true, permissions: ["legal:create"], feature: "legal" },
  async (request: NextRequest, ctx) => {
    const formData = await request.formData();
    const upload = await readLegalUpload(formData, true);
    const payload = createLegalDocumentSchema.parse(readLegalPayload(formData));

    const document = await documents.create(payload, upload!, {
      userId: ctx.session!.user.id,
      access: legalAccessFrom(ctx),
    });

    return apiSuccess(toLegalDocumentDetail(document));
  },
);
