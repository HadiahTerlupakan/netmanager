import * as z from "zod";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

const queryFaceVerificationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

async function ensureMitraInScope(
  mitraId: string,
  user: { id: string; name?: string },
): Promise<{ allowed: boolean; error?: string }> {
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  const mitra = await getMitraService().getMitraById(mitraId);
  if (!mitra.success) return { allowed: false, error: "Mitra tidak ditemukan" };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

export const GET = createHandler(
  {
    auth: true,
    permissions: ["mitra:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user);
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
