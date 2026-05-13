import { RadiusSyncService } from "@/modules/network";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { z } from "zod";

const radiusSyncService = new RadiusSyncService();

const deleteOrphansBodySchema = z.object({
  usernames: z.array(z.string().min(1)).optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const orphans = await radiusSyncService.listOrphanRadiusUsers(tenantId);

    return apiSuccess({
      orphans,
      total: orphans.length,
    });
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["radius:delete"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    let usernames: string[] | undefined;

    const rawBody = await req.text();
    if (rawBody) {
      const parsed = deleteOrphansBodySchema.safeParse(JSON.parse(rawBody));
      if (!parsed.success) {
        return ApiErrors.badRequest("Format body tidak valid");
      }
      usernames = parsed.data.usernames;
    }

    const result = await radiusSyncService.cleanupOrphanRadiusUsers(
      tenantId,
      usernames,
    );

    return apiSuccess(result, {
      message: `${result.deleted} user orphan berhasil dihapus dari RADIUS`,
    });
  },
);
