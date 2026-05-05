import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { MixRadiusOwnerGroupFacadeService } from "@/modules/integrations";

export const dynamic = "force-dynamic";

/**
 * PUT /api/integrations/mixradius/groups/[id]
 * Update owner group
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (!isSuper && !permissions.includes("mixradius:update")) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  const body = await req.json();
  const { name, owners, siteId, isActive } = body;

  if (!isSuper && !user.tenantId) {
    return ApiErrors.badRequest(
      "Tenant MixRadius tidak ditemukan untuk user ini",
    );
  }

  const service = new MixRadiusOwnerGroupFacadeService();
  const updatedGroup = await service.updateOwnerGroup(id, {
    name,
    owners,
    siteId,
    isActive,
    tenantId: isSuper ? undefined : user.tenantId,
  });

  logActivitySafe({
    action: "UPDATE",
    subject: "MixRadius Group",
    userId: user.id,
    details: { id, changes: { name, owners, isActive } },
  });

  return apiSuccess(updatedGroup);
});

/**
 * DELETE /api/integrations/mixradius/groups/[id]
 * Delete owner group
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (
    !isSuper &&
    !permissions.includes("mixradius:delete") &&
    !permissions.includes("*")
  ) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  if (!isSuper && !user.tenantId) {
    return ApiErrors.badRequest(
      "Tenant MixRadius tidak ditemukan untuk user ini",
    );
  }

  const service = new MixRadiusOwnerGroupFacadeService();
  await service.deleteOwnerGroup(id, isSuper ? undefined : user.tenantId);

  logActivitySafe({
    action: "DELETE",
    subject: "MixRadius Group",
    userId: user.id,
    details: { id },
  });

  return apiSuccess({ success: true });
});
