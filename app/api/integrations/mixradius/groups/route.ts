import { isSuperAdmin } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import {
  getMixRadiusAccessService,
  getMixRadiusGroupRouteService,
  MixRadiusOwnerGroupFacadeService,
} from "@/modules/integrations";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: [
      "mixradius_sites:read",
      "mixradius:read",
      "m_mixradius:read",
    ],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: mixradius_sites:read",
    );
  }

  const isSuper = isSuperAdmin(user);

  if (!isSuper && !user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  try {
    const routeService = getMixRadiusGroupRouteService();
    const groups = await routeService.getAdminGroups(
      isSuper ? undefined : user.tenantId,
    );

    return apiSuccess(groups);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "MixRadiusConfigError") {
      return apiError(error.message, ErrorCodes.INVALID_STATUS, {
        status: 400,
        details: { isConfigError: true },
      });
    }
    throw error;
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius_sites:create", "mixradius:create"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: mixradius_sites:create",
    );
  }

  const body = await req.json();
  const { name, owners, siteId, isActive } = body;
  const missingFields = getMissingGroupFields(name, owners);

  if (missingFields.length > 0) {
    return apiError(
      `Data berikut wajib diisi: ${missingFields.join(", ")}`,
      ErrorCodes.VALIDATION_ERROR,
      { details: { missingFields }, status: 400 },
    );
  }

  const isSuper = isSuperAdmin(user);

  if (!isSuper && !user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const service = new MixRadiusOwnerGroupFacadeService();
  const newGroup = await service.createOwnerGroup({
    name,
    owners,
    siteId,
    isActive,
    tenantId: isSuper ? undefined : user.tenantId,
  });

  logActivitySafe({
    action: "CREATE",
    subject: "MixRadius Group",
    userId: user.id,
    details: { id: newGroup.id, name: newGroup.name, owners: newGroup.owners },
  });

  return apiSuccess(newGroup, { status: 201 });
});

function getMissingGroupFields(name: unknown, owners: unknown) {
  const missingFields: string[] = [];

  if (typeof name !== "string" || !name.trim()) {
    missingFields.push("Nama Site");
  }

  if (!Array.isArray(owners) || owners.length === 0) {
    missingFields.push("Owner (minimal 1)");
  }

  return missingFields;
}
