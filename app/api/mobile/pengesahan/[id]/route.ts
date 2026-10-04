import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import { getClientInfoFromHeaders } from "@/lib/request-helpers";
import { EndorsementInboxService } from "@/modules/endorsement";

const inbox = new EndorsementInboxService();

/** GET /api/mobile/pengesahan/[id] — detail surat untuk penanda tangannya (mencatat "sudah dibuka"). */
export const GET = createHandler(
  { auth: true },
  async (request: NextRequest, ctx) => {
    const detail = await inbox.detail(
      ctx.params.id as string,
      ctx.session!.user.id,
      getClientInfoFromHeaders(request.headers),
    );

    return apiSuccess(detail);
  },
);
