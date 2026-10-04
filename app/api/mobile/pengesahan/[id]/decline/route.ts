import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import { getClientInfoFromHeaders } from "@/lib/request-helpers";
import {
  declineEndorsementSchema,
  EndorsementInboxService,
} from "@/modules/endorsement";

const inbox = new EndorsementInboxService();

/** POST /api/mobile/pengesahan/[id]/decline — tolak mengesahkan dari aplikasi. */
export const POST = createHandler(
  { auth: true, schema: declineEndorsementSchema },
  async (request: NextRequest, ctx) => {
    await inbox.decline(ctx.params.id as string, ctx.session!.user.id, {
      reason: ctx.validated.reason,
      context: getClientInfoFromHeaders(request.headers),
    });

    return apiSuccess({ declined: true });
  },
);
