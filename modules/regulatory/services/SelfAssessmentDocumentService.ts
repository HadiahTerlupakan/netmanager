import {
  catalogOf,
  parametersOf,
  type LicenseScheme,
} from "../domain/license-schemes";
import {
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
import {
  GeneralSettingsCompanyIdentity,
  SettingsDocumentStore,
} from "./settings-document-store";

/**
 * Dokumen Word "Pelaporan Kinerja … Berdasarkan Self Assessment" sesuai
 * template Komdigi: profil penyelenggara + capaian (hitungan sistem untuk
 * pasang baru & pemulihan, isian manual untuk parameter lain).
 */

export interface SelfAssessmentDocumentForm {
  year: number;
  profile: OperatorProfile;
  yearly: YearlyDocumentInput;
  computed: ComputedAchievements;
}

/** Ambil rasio tahunan satu parameter dari laporan. */
function annualRatio(report: SelfAssessmentReport, key: string): number | null {
  return (
    report.parameters.find((parameter) => parameter.parameter.key === key)
      ?.annual.ratio ?? null
  );
}

/**
 * Capaian hitungan sistem, berkunci parameter katalog.
 *
 * Laporan work order masih memakai kunci lamanya (`PASANG_BARU`,
 * `PEMULIHAN_LAYANAN`), jadi dipetakan lewat jenis perhitungan parameter —
 * bukan lewat daftar kunci yang ditulis ulang di sini.
 */
function computedFromReport(
  report: SelfAssessmentReport,
  scheme: LicenseScheme,
): Record<string, number | null> {
  const hasil: Record<string, number | null> = {};
  for (const parameter of parametersOf(scheme)) {
    if (parameter.auto?.kind === "WORK_ORDER_DURATION") {
      hasil[parameter.key] = annualRatio(report, parameter.auto.workOrder);
    }
  }
  return hasil;
}

/**
 * Profil tersimpan; yang kosong diisi dari Pengaturan Umum / nilai baku.
 *
 * Jenis izin bawaannya mengikuti skema — tenant yang memegang dua izin tidak
 * boleh melihat "Jaringan Tetap Lokal" tercetak di formulir ISP-nya.
 */
function withDefaults(
  profile: OperatorProfile,
  company: CompanyIdentity,
  scheme: LicenseScheme,
): OperatorProfile {
  return {
    ...profile,
    operatorName: profile.operatorName || company.name,
    operatorAddress: profile.operatorAddress || company.address,
    licenseType: profile.licenseType || catalogOf(scheme).licenseTypeLabel,
  };
}

function letterheadContact(
  profile: OperatorProfile,
  company: CompanyIdentity,
): string {
  return [profile.operatorAddress, company.phone, company.email]
    .filter(Boolean)
    .join(" · ");
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
  async getForm(
    year: number,
    tenantId: string,
    scheme: LicenseScheme,
  ): Promise<SelfAssessmentDocumentForm> {
    const [profile, yearly, company, report] = await Promise.all([
      this.store.getProfile(tenantId, scheme),
      this.store.getYearlyInput(tenantId, scheme, year),
      this.company.getCompanyIdentity(),
      this.reports.build(year, tenantId, scheme),
    ]);

    return {
      year,
      profile: withDefaults(profile, company, scheme),
      yearly,
      computed: computedFromReport(report, scheme),
    };
  }

  /** Simpan profil penyelenggara dan isian tahun tersebut. */
  async saveForm(
    year: number,
    tenantId: string,
    scheme: LicenseScheme,
    input: { profile: OperatorProfile; yearly: YearlyDocumentInput },
  ): Promise<void> {
    await Promise.all([
      this.store.saveProfile(tenantId, scheme, input.profile),
      this.store.saveYearlyInput(tenantId, scheme, year, input.yearly),
    ]);
  }

  /** Berkas .docx terisi untuk tahun tersebut. */
  async renderDocument(
    year: number,
    tenantId: string,
    scheme: LicenseScheme,
  ): Promise<Buffer> {
    const [form, company] = await Promise.all([
      this.getForm(year, tenantId, scheme),
      this.company.getCompanyIdentity(),
    ]);

    return this.renderTemplate(
      catalogOf(scheme).templateFile,
      buildDocumentValues({
        year,
        scheme,
        profile: form.profile,
        yearly: form.yearly,
        computed: form.computed,
        letterheadContact: letterheadContact(form.profile, company),
        signingDate: this.clock(),
      }),
    );
  }
}
