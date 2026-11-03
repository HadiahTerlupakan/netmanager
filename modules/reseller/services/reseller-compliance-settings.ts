import { getTenantSettingsMap, upsertTenantSettings } from "@/modules/settings";
import type { IResellerComplianceSettings } from "../domain/ports/IResellerComplianceSettings";

/** Kunci pengaturan tenant "wajibkan kepatuhan reseller". */
export const RESELLER_COMPLIANCE_REQUIRED_KEY = "RESELLER_COMPLIANCE_REQUIRED";
const ENABLED_VALUE = "true";
const DISABLED_VALUE = "false";

/** Pengaturan kepatuhan reseller yang disimpan di tabel settings per tenant. */
export class TenantResellerComplianceSettings implements IResellerComplianceSettings {
  /** Default OFF: tenant yang belum menyimpan pengaturan tidak diblokir. */
  async isComplianceRequired(tenantId: string): Promise<boolean> {
    const settings = await getTenantSettingsMap(tenantId, [
      { key: RESELLER_COMPLIANCE_REQUIRED_KEY, defaultValue: DISABLED_VALUE },
    ]);
    return settings[RESELLER_COMPLIANCE_REQUIRED_KEY] === ENABLED_VALUE;
  }

  /** Simpan pengaturan wajib kepatuhan untuk tenant. */
  async setComplianceRequired(
    tenantId: string,
    isRequired: boolean,
  ): Promise<void> {
    await upsertTenantSettings(tenantId, [
      {
        key: RESELLER_COMPLIANCE_REQUIRED_KEY,
        value: isRequired ? ENABLED_VALUE : DISABLED_VALUE,
        description:
          "Tolak penugasan pelanggan baru ke reseller yang belum patuh (izin + PKS)",
      },
    ]);
  }
}
