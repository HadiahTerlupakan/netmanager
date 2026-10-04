import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  LegalDocumentService,
  renewLegalDocumentSchema,
  toLegalDocumentDetail,
} from "@/modules/legal";
import {
  legalAccessFrom,
  readLegalPayload,
  readLegalUpload,
} from "../../../legal-route-helpers";

const documents = new LegalDocumentService();

/**
 * POST /api/admin/legal/documents/[id]/renew — perpanjang (multipart: file
 * opsional + payload JSON berisi masa berlaku baru). Mengembalikan dokumen baru.
 */
export const POST = createHandler(
  { auth: true, permissions: ["legal:update"], feature: "legal" },
  async (request: NextRequest, ctx) => {
    const formData = await request.formData();
    const upload = await readLegalUpload(formData, false);
    const payload = renewLegalDocumentSchema.parse(readLegalPayload(formData));

    const renewed = await documents.renew(ctx.params.id as string, payload, upload, {
      userId: ctx.session!.user.id,
      access: legalAccessFrom(ctx),
    });

    return apiSuccess(toLegalDocumentDetail(renewed));
  },
);
