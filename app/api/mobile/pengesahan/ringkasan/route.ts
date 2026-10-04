import { apiSuccess, createHandler } from "@/lib/api";
import { EndorsementInboxService } from "@/modules/endorsement";

const inbox = new EndorsementInboxService();

/** GET /api/mobile/pengesahan/ringkasan — jumlah surat menunggu & total; menentukan tampilnya menu. */
export const GET = createHandler({ auth: true }, async (_request, ctx) => {
  const { waitingCount, totalCount } = await inbox.summary(
    ctx.session!.user.id,
  );

  return apiSuccess({ menungguCount: waitingCount, totalCount });
});
