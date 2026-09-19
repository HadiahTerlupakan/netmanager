import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraService } from "@/modules/mitra";
import { ensureMitraInScope } from "@/lib/api/guards";

const queryFaceVerificationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = createHandler(
  {
    auth: true,
    permissions: ["mitra:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const parsed = queryFaceVerificationSchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest("Query parameter tidak valid");
    }
    const { page, limit } = parsed.data;

    const result = await getMitraService().getFaceVerificationLogs(
      id,
      user.tenantId,
      page,
      limit,
    );

    if (!result.success) {
      return ApiErrors.notFound(result.error);
    }

    return apiSuccess(result.data);
  },
);
