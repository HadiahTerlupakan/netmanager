import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import type { FeatureModuleCode } from "@/lib/feature-modules";
import {
  featureFlagBatchUpdateSchema,
  getFeatureFlagService,
} from "@/modules/feature-flags";

/**
 * GET /api/admin/tenants/[id]/feature-flags
 *
 * Listing feature flag untuk tenant tertentu (super admin only). Mengembalikan
 * gabungan catalog modul + state per tenant.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const tenantId = ctx.params.id;
  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID wajib");
  }

  const items = await getFeatureFlagService().getCatalogForTenant(tenantId);
  return apiSuccess({ items });
});

/**
 * PATCH /api/admin/tenants/[id]/feature-flags
 *
 * Body: `{ updates: [{ feature, enabled }] }`. Batch upsert. Super admin only.
 */
export const PATCH = createHandler(
  { auth: true, schema: featureFlagBatchUpdateSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const tenantId = ctx.params.id;
    if (!tenantId) {
      return ApiErrors.badRequest("Tenant ID wajib");
    }

    const updatedBy = ctx.session?.user?.id ?? null;
    // Zod enum schema sudah memvalidasi `feature` against FEATURE_MODULES,
    // tetapi tipe outputnya `string` (Zod enum dari array dinamis). Cast aman
    // karena validator sudah menjamin nilai valid.
    const updates = ctx.validated.updates as Array<{
      feature: FeatureModuleCode;
      enabled: boolean;
    }>;
    const result = await getFeatureFlagService().setBatch(
      tenantId,
      updates,
      updatedBy,
    );
    return apiSuccess({ updated: result });
  },
);
