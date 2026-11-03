import { getTenantSettingsMap, upsertTenantSettings } from "@/modules/settings";
import type { IResellerComplianceSettings } from "../domain/ports/IResellerComplianceSettings";

/** Kunci pengaturan tenant "wajibkan kepatuhan reseller". */
export const RESELLER_COMPLIANCE_REQUIRED_KEY = "RESELLER_COMPLIANCE_REQUIRED";
/** Kunci pengaturan tenant "pembayar settlement harus beda dari penyetuju". */
export const RESELLER_SETTLEMENT_SEPARATE_APPROVER_KEY =
  "RESELLER_SETTLEMENT_SEPARATE_APPROVER";
const ENABLED_VALUE = "true";
const DISABLED_VALUE = "false";

/**
 * Pengaturan tata kelola reseller yang disimpan di tabel settings per tenant.
 * Semua sakelar default OFF: tenant yang belum menyimpan tidak diblokir.
 */
export class TenantResellerComplianceSettings implements IResellerComplianceSettings {
  /** Wajibkan reseller patuh (izin + PKS) sebelum menerima pelanggan baru. */
  async isComplianceRequired(tenantId: string): Promise<boolean> {
    return readFlag(tenantId, RESELLER_COMPLIANCE_REQUIRED_KEY);
  }

  /** Simpan pengaturan wajib kepatuhan untuk tenant. */
  async setComplianceRequired(
    tenantId: string,
    isRequired: boolean,
  ): Promise<void> {
    await writeFlag(
      tenantId,
      RESELLER_COMPLIANCE_REQUIRED_KEY,
      isRequired,
      "Tolak penugasan pelanggan baru ke reseller yang belum patuh (izin + PKS)",
    );
  }

  /** Pembayar settlement komisi wajib berbeda dari penyetujunya. */
  async isSettlementSeparateApproverRequired(
    tenantId: string,
  ): Promise<boolean> {
    return readFlag(tenantId, RESELLER_SETTLEMENT_SEPARATE_APPROVER_KEY);
  }

  /** Simpan pengaturan pemisahan penyetuju & pembayar settlement. */
  async setSettlementSeparateApproverRequired(
    tenantId: string,
    isRequired: boolean,
  ): Promise<void> {
    await writeFlag(
      tenantId,
      RESELLER_SETTLEMENT_SEPARATE_APPROVER_KEY,
      isRequired,
      "Tolak pembayaran settlement reseller oleh pengguna yang menyetujuinya",
    );
  }
}

async function readFlag(tenantId: string, key: string): Promise<boolean> {
  const settings = await getTenantSettingsMap(tenantId, [
    { key, defaultValue: DISABLED_VALUE },
  ]);
  return settings[key] === ENABLED_VALUE;
}

async function writeFlag(
  tenantId: string,
  key: string,
  isEnabled: boolean,
  description: string,
): Promise<void> {
  await upsertTenantSettings(tenantId, [
    { key, value: isEnabled ? ENABLED_VALUE : DISABLED_VALUE, description },
  ]);
}
