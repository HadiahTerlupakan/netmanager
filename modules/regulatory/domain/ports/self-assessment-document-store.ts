import type { LicenseScheme } from "../license-schemes";
import type {
  OperatorProfile,
  YearlyDocumentInput,
} from "../self-assessment-document";

/**
 * Penyimpanan profil penyelenggara & isian dokumen per tahun, per tenant dan
 * per jenis izin.
 *
 * Satu tenant bisa memegang izin Jartaplok PS dan ISP sekaligus, dan isiannya
 * tidak boleh saling menimpa: nomor izin, tanggal izin, bahkan capaian manual
 * tiap parameter berbeda antar-izin.
 */
export interface SelfAssessmentDocumentStore {
  /** Profil tersimpan; field yang belum pernah diisi = string kosong. */
  getProfile(tenantId: string, scheme: LicenseScheme): Promise<OperatorProfile>;
  saveProfile(
    tenantId: string,
    scheme: LicenseScheme,
    profile: OperatorProfile,
  ): Promise<void>;
  getYearlyInput(
    tenantId: string,
    scheme: LicenseScheme,
    year: number,
  ): Promise<YearlyDocumentInput>;
  saveYearlyInput(
    tenantId: string,
    scheme: LicenseScheme,
    year: number,
    input: YearlyDocumentInput,
  ): Promise<void>;
}

/** Identitas perusahaan dari Pengaturan Umum, untuk nilai awal profil & kop surat. */
export interface CompanyIdentity {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface CompanyIdentitySource {
  getCompanyIdentity(): Promise<CompanyIdentity>;
}
