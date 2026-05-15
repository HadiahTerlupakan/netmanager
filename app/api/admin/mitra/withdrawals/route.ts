import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraWithdrawService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

const listQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = createHandler(
  {
    auth: true,
    permissions: ["withdrawals:read"],
  },
  async (_request, ctx) => {
    const parsed = listQuerySchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest("Query parameter tidak valid");
    }
    const { status, page, limit } = parsed.data;

    const { isRestricted, siteIds } = checkSiteRestriction(
      { user: ctx.session!.user } as never,
      "withdrawals",
    );

    const result = await getMitraWithdrawService().getWithdrawRequests({
      status,
      page,
      limit,
      allowedSiteIds: isRestricted ? siteIds : undefined,
    });

    if (!result.success) {
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(result.data);
  },
);
