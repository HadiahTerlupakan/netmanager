import { ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { MAIN_TENANT_ID } from "@/modules/mitra";

/**
 * Versi minimum aplikasi mobile berlaku untuk semua tenant, jadi hanya admin
 * tenant utama yang boleh melihat atau mengubahnya. Null bila diizinkan.
 */
export async function denyUnlessMainTenant(
  tenantId: string | null | undefined,
  permission: "app_version:read" | "app_version:update",
) {
  if (tenantId !== MAIN_TENANT_ID) {
    return ApiErrors.forbidden("Hanya untuk tenant utama");
  }
  if (!(await hasPermission(permission))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengatur versi aplikasi",
    );
  }
  return null;
}
