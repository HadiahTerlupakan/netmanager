import { logger } from "@/lib/logger";
import { getGeneralSettings, getTenantSettingsMap, upsertTenantSettings } from "@/modules/settings";
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

const yearlyInputKey = (year: number) => `REGULASI_SELF_ASSESSMENT_${year}`;
const profileFields = Object.values(PROFILE_KEYS).map((key) => ({ key, defaultValue: "" }));

function parseYearlyInput(raw: string): YearlyDocumentInput {
  if (!raw) return EMPTY_YEARLY_INPUT;
  try {
    const parsed = JSON.parse(raw) as Partial<YearlyDocumentInput>;
    return {
      manualAchievements: parsed.manualAchievements ?? {},
      supportingLinks: parsed.supportingLinks ?? {},
    };
  } catch (error) {
    logger.warn("[Regulatory] Isian dokumen tahunan rusak, dianggap kosong:", error);
    return EMPTY_YEARLY_INPUT;
  }
}

export class SettingsDocumentStore implements SelfAssessmentDocumentStore {
  async getProfile(tenantId: string): Promise<OperatorProfile> {
    const values = await getTenantSettingsMap(tenantId, profileFields);
    const entries = Object.entries(PROFILE_KEYS).map(([field, key]) => [field, values[key] ?? ""]);
    return Object.fromEntries(entries) as OperatorProfile;
  }

  async saveProfile(tenantId: string, profile: OperatorProfile): Promise<void> {
    await upsertTenantSettings(
      tenantId,
      Object.entries(PROFILE_KEYS).map(([field, key]) => ({
        key,
        value: profile[field as keyof OperatorProfile],
        description: "Profil penyelenggara untuk Self-Assessment Komdigi",
      })),
    );
  }

  async getYearlyInput(tenantId: string, year: number): Promise<YearlyDocumentInput> {
    const key = yearlyInputKey(year);
    const values = await getTenantSettingsMap(tenantId, [{ key, defaultValue: "" }]);
    return parseYearlyInput(values[key] ?? "");
  }

  async saveYearlyInput(tenantId: string, year: number, input: YearlyDocumentInput): Promise<void> {
    await upsertTenantSettings(tenantId, [
      {
        key: yearlyInputKey(year),
        value: JSON.stringify(input),
        description: `Isian dokumen Self-Assessment Komdigi ${year}`,
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
