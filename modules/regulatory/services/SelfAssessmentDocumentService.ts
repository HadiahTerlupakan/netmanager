import {
  DEFAULT_LICENSE_TYPE,
  buildDocumentValues,
  type ComputedAchievements,
  type OperatorProfile,
  type YearlyDocumentInput,
} from "../domain/self-assessment-document";
import type {
  CompanyIdentity,
  CompanyIdentitySource,
  SelfAssessmentDocumentStore,
} from "../domain/ports/self-assessment-document-store";
import type { SelfAssessmentReport } from "../domain/self-assessment-report";
import { fillDocxTemplate } from "./docx-template";
import { SelfAssessmentReportService } from "./SelfAssessmentReportService";
import { GeneralSettingsCompanyIdentity, SettingsDocumentStore } from "./settings-document-store";

/**
 * Dokumen Word "Pelaporan Kinerja … Berdasarkan Self Assessment" sesuai
 * template Komdigi: profil penyelenggara + capaian (hitungan sistem untuk
 * pasang baru & pemulihan, isian manual untuk parameter lain).
 */

const TEMPLATE_FILE = "self-assessment-komdigi.docx";

export interface SelfAssessmentDocumentForm {
  year: number;
  profile: OperatorProfile;
  yearly: YearlyDocumentInput;
  computed: ComputedAchievements;
}

/** Ambil rasio tahunan satu parameter dari laporan. */
function annualRatio(report: SelfAssessmentReport, key: string): number | null {
  return report.parameters.find((parameter) => parameter.parameter.key === key)?.annual.ratio ?? null;
}

/** Profil tersimpan; yang kosong diisi dari Pengaturan Umum / nilai baku. */
function withDefaults(profile: OperatorProfile, company: CompanyIdentity): OperatorProfile {
  return {
    ...profile,
    operatorName: profile.operatorName || company.name,
    operatorAddress: profile.operatorAddress || company.address,
    licenseType: profile.licenseType || DEFAULT_LICENSE_TYPE,
  };
}

function letterheadContact(profile: OperatorProfile, company: CompanyIdentity): string {
  return [profile.operatorAddress, company.phone, company.email].filter(Boolean).join(" · ");
}

export class SelfAssessmentDocumentService {
  constructor(
    private readonly store: SelfAssessmentDocumentStore = new SettingsDocumentStore(),
    private readonly company: CompanyIdentitySource = new GeneralSettingsCompanyIdentity(),
    private readonly reports: SelfAssessmentReportService = new SelfAssessmentReportService(),
    private readonly renderTemplate: typeof fillDocxTemplate = fillDocxTemplate,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Isian formulir dokumen untuk satu tahun, beserta capaian hitungan sistem. */
  async getForm(year: number, tenantId: string): Promise<SelfAssessmentDocumentForm> {
    const [profile, yearly, company, report] = await Promise.all([
      this.store.getProfile(tenantId),
      this.store.getYearlyInput(tenantId, year),
      this.company.getCompanyIdentity(),
      this.reports.build(year, tenantId),
    ]);

    return {
      year,
      profile: withDefaults(profile, company),
      yearly,
      computed: {
        newInstallation: annualRatio(report, "PASANG_BARU"),
        restoration: annualRatio(report, "PEMULIHAN_LAYANAN"),
      },
    };
  }

  /** Simpan profil penyelenggara dan isian tahun tersebut. */
  async saveForm(
    year: number,
    tenantId: string,
    input: { profile: OperatorProfile; yearly: YearlyDocumentInput },
  ): Promise<void> {
    await Promise.all([
      this.store.saveProfile(tenantId, input.profile),
      this.store.saveYearlyInput(tenantId, year, input.yearly),
    ]);
  }

  /** Berkas .docx terisi untuk tahun tersebut. */
  async renderDocument(year: number, tenantId: string): Promise<Buffer> {
    const [form, company] = await Promise.all([
      this.getForm(year, tenantId),
      this.company.getCompanyIdentity(),
    ]);

    return this.renderTemplate(
      TEMPLATE_FILE,
      buildDocumentValues({
        year,
        profile: form.profile,
        yearly: form.yearly,
        computed: form.computed,
        letterheadContact: letterheadContact(form.profile, company),
        signingDate: this.clock(),
      }),
    );
  }
}
