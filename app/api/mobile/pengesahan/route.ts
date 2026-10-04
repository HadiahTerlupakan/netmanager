import { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  EndorsementInboxService,
  signerInboxQuerySchema,
} from "@/modules/endorsement";

const inbox = new EndorsementInboxService();

/**
 * GET /api/mobile/pengesahan?status=MENUNGGU|SELESAI&page=&limit=
 *
 * Surat yang menunjuk user yang login sebagai penanda tangan. Tidak butuh
 * izin khusus: ditunjuk di surat itulah hak aksesnya, dan data dibatasi ke
 * surat milik user sendiri.
 */
export const GET = createHandler(
  { auth: true },
  async (request: NextRequest, ctx) => {
    const { searchParams } = new URL(request.url);
    const query = signerInboxQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await inbox.list({
      userId: ctx.session!.user.id,
      scope: query.status,
      page: query.page,
      limit: query.limit,
    });

    return apiSuccess({ ...result, page: query.page, limit: query.limit });
  },
);
