import type { OperatorProfile, YearlyDocumentInput } from "../self-assessment-document";

/** Penyimpanan profil penyelenggara & isian dokumen per tahun (per tenant). */
export interface SelfAssessmentDocumentStore {
  /** Profil tersimpan; field yang belum pernah diisi = string kosong. */
  getProfile(tenantId: string): Promise<OperatorProfile>;
  saveProfile(tenantId: string, profile: OperatorProfile): Promise<void>;
  getYearlyInput(tenantId: string, year: number): Promise<YearlyDocumentInput>;
  saveYearlyInput(tenantId: string, year: number, input: YearlyDocumentInput): Promise<void>;
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
