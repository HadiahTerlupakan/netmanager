import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import { getClientInfoFromHeaders } from "@/lib/request-helpers";
import {
  EndorsementInboxService,
  parseSignatureDataUrl,
  signEndorsementSchema,
} from "@/modules/endorsement";

const inbox = new EndorsementInboxService();

/**
 * POST /api/mobile/pengesahan/[id]/sign — bubuhkan tanda tangan dari aplikasi.
 * Pengiriman ganda aman: hanya permintaan pertama yang mengubah status.
 */
export const POST = createHandler(
  { auth: true, schema: signEndorsementSchema },
  async (request: NextRequest, ctx) => {
    const result = await inbox.sign(
      ctx.params.id as string,
      ctx.session!.user.id,
      {
        buffer: parseSignatureDataUrl(ctx.validated.signatureDataUrl),
        context: getClientInfoFromHeaders(request.headers),
      },
    );

    return apiSuccess(result);
  },
);
