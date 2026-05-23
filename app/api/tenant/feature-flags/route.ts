import { apiSuccess, createHandler } from "@/lib/api";
import { getFeatureFlagService } from "@/modules/feature-flags";
import type { TenantFeatureFlagsResponseDTO } from "@/modules/feature-flags";

/**
 * GET /api/tenant/feature-flags
 *
 * Return daftar feature module yang DISABLE untuk tenant user yang login.
 * Dipakai oleh `FeatureFlagsContext` di client untuk filter sidebar.
 *
 * Super admin (cross-tenant context) → return list kosong (lihat semua).
 * User tanpa tenantId (kasus aneh) → return list kosong (default open).
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const tenantId = ctx.session?.user?.tenantId;
  const isSuperAdmin = ctx.session?.user?.isSuperAdmin === true;

  if (!tenantId || isSuperAdmin) {
    const empty: TenantFeatureFlagsResponseDTO = { disabledFeatures: [] };
    return apiSuccess(empty);
  }

  const disabledFeatures =
    await getFeatureFlagService().getDisabledFeatures(tenantId);
  const response: TenantFeatureFlagsResponseDTO = { disabledFeatures };
  return apiSuccess(response);
});
