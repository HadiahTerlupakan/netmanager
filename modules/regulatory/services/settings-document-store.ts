import { logger } from "@/lib/logger";
import {
  getGeneralSettings,
  getTenantSettingsMap,
  upsertTenantSettings,
} from "@/modules/settings";
import type { LicenseScheme } from "../domain/license-schemes";
import {
  EMPTY_YEARLY_INPUT,
  type OperatorProfile,
  type YearlyDocumentInput,
} from "../domain/self-assessment-document";
import type {
  CompanyIdentity,
  CompanyIdentitySource,
  SelfAssessmentDocumentStore,
} from "../domain/ports/self-assessment-document-store";

/**
 * Profil penyelenggara & isian dokumen per tahun disimpan di pengaturan tenant
 * (key-value), jadi tidak butuh tabel baru.
 */

/**
 * Jartaplok PS memakai kunci tanpa akhiran — bentuk yang sudah dipakai sebelum
 * ISP ada. Dipertahankan supaya tenant yang sudah mengisi tidak kehilangan
 * datanya dan tidak perlu migrasi; skema baru cukup diberi akhiran sendiri.
 */
const SCHEME_SUFFIX: Record<LicenseScheme, string> = {
  JARTAPLOK_PS: "",
  ISP: "_ISP",
};

const scopedKey = (base: string, scheme: LicenseScheme) =>
  `${base}${SCHEME_SUFFIX[scheme]}`;

const PROFILE_KEYS: Record<keyof OperatorProfile, string> = {
  operatorName: "REGULASI_NAMA_PENYELENGGARA",
  licenseType: "REGULASI_JENIS_IZIN",
  operatorAddress: "REGULASI_ALAMAT_PENYELENGGARA",
  licenseNumber: "REGULASI_NOMOR_IZIN",
  licenseDate: "REGULASI_TANGGAL_IZIN",
  licenseAttachmentUrl: "REGULASI_LINK_IZIN",
  signingCity: "REGULASI_KOTA_TANDA_TANGAN",
  directorName: "REGULASI_NAMA_DIREKTUR",
};

const yearlyInputKey = (scheme: LicenseScheme, year: number) =>
  scopedKey(`REGULASI_SELF_ASSESSMENT_${year}`, scheme);

const profileFieldsOf = (scheme: LicenseScheme) =>
  Object.values(PROFILE_KEYS).map((key) => ({
    key: scopedKey(key, scheme),
    defaultValue: "",
  }));

function parseYearlyInput(raw: string): YearlyDocumentInput {
  if (!raw) return EMPTY_YEARLY_INPUT;
  try {
    const parsed = JSON.parse(raw) as Partial<YearlyDocumentInput>;
    return {
      manualAchievements: parsed.manualAchievements ?? {},
      supportingLinks: parsed.supportingLinks ?? {},
    };
  } catch (error) {
    logger.warn(
      "[Regulatory] Isian dokumen tahunan rusak, dianggap kosong:",
      error,
    );
    return EMPTY_YEARLY_INPUT;
  }
}

export class SettingsDocumentStore implements SelfAssessmentDocumentStore {
  async getProfile(
    tenantId: string,
    scheme: LicenseScheme,
  ): Promise<OperatorProfile> {
    const values = await getTenantSettingsMap(
      tenantId,
      profileFieldsOf(scheme),
    );
    const entries = Object.entries(PROFILE_KEYS).map(([field, key]) => [
      field,
      values[scopedKey(key, scheme)] ?? "",
    ]);
    return Object.fromEntries(entries) as OperatorProfile;
  }

  async saveProfile(
    tenantId: string,
    scheme: LicenseScheme,
    profile: OperatorProfile,
  ): Promise<void> {
    await upsertTenantSettings(
      tenantId,
      Object.entries(PROFILE_KEYS).map(([field, key]) => ({
        key: scopedKey(key, scheme),
        value: profile[field as keyof OperatorProfile],
        description: `Profil penyelenggara Self-Assessment Komdigi (${scheme})`,
      })),
    );
  }

  async getYearlyInput(
    tenantId: string,
    scheme: LicenseScheme,
    year: number,
  ): Promise<YearlyDocumentInput> {
    const key = yearlyInputKey(scheme, year);
    const values = await getTenantSettingsMap(tenantId, [
      { key, defaultValue: "" },
    ]);
    return parseYearlyInput(values[key] ?? "");
  }

  async saveYearlyInput(
    tenantId: string,
    scheme: LicenseScheme,
    year: number,
    input: YearlyDocumentInput,
  ): Promise<void> {
    await upsertTenantSettings(tenantId, [
      {
        key: yearlyInputKey(scheme, year),
        value: JSON.stringify(input),
        description: `Isian dokumen Self-Assessment Komdigi ${scheme} ${year}`,
      },
    ]);
  }
}

/** Identitas perusahaan dari Pengaturan Umum tenant aktif. */
export class GeneralSettingsCompanyIdentity implements CompanyIdentitySource {
  async getCompanyIdentity(): Promise<CompanyIdentity> {
    const settings = await getGeneralSettings();
    return {
      name: settings.perusahaan,
      address: settings.alamat,
      phone: settings.nomorHp,
      email: settings.email,
    };
  }
}
