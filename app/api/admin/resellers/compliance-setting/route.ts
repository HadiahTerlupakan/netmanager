import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  getResellerComplianceService,
  RESELLER_COMPLIANCE_SETTING_PERMISSIONS,
  updateResellerComplianceSettingSchema,
} from "@/modules/reseller";

/** Pengaturan tenant "wajibkan kepatuhan reseller" (default mati). */
export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const setting = await getResellerComplianceService().getComplianceSetting(
      requireSessionTenantId(ctx),
    );
    return apiSuccess(setting);
  },
);

/**
 * Ubah pengaturan kepatuhan reseller. Ini kontrol tingkat tenant, jadi butuh
 * izin pengaturan umum DAN izin reseller: staf yang hanya mengelola reseller
 * tidak boleh mematikan gerbangnya sendiri.
 */
export const PUT = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_COMPLIANCE_SETTING_PERMISSIONS],
    schema: updateResellerComplianceSettingSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const setting =
      await getResellerComplianceService().updateComplianceSetting(
        requireSessionTenantId(ctx),
        ctx.validated.isComplianceRequired,
      );
    return apiSuccess(setting);
  },
);
