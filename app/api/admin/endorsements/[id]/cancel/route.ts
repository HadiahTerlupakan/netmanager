import { apiSuccess, createHandler } from "@/lib/api";
import {
  cancelEndorsementSchema,
  EndorsementService,
} from "@/modules/endorsement";

const service = new EndorsementService();

/** POST /api/admin/endorsements/[id]/cancel — batalkan surat. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["pengesahan:update"],
    schema: cancelEndorsementSchema,
  },
  async (_request, ctx) => {
    await service.cancel(ctx.params.id as string, ctx.validated.reason);

    return apiSuccess({ cancelled: true });
  },
);
