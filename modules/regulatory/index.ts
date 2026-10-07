/**
 * Public API modul regulatory (laporan kepatuhan regulator, mis. Self-Assessment Komdigi).
 *
 * Modul lain hanya boleh mengimpor dari berkas ini.
 */

export { SelfAssessmentReportService } from "./services/SelfAssessmentReportService";
export { buildSelfAssessmentWorkbook } from "./services/SelfAssessmentWorkbook";
export { buildSelfAssessmentLampiran } from "./services/SelfAssessmentLampiran";
export {
  toSelfAssessmentSummary,
  type ParameterSummaryDto,
  type SelfAssessmentSummaryDto,
} from "./dto/self-assessment.dto";
export { selfAssessmentQuerySchema } from "./validators/self-assessment.validator";
export {
  SelfAssessmentDocumentService,
  type SelfAssessmentDocumentForm,
} from "./services/SelfAssessmentDocumentService";
export {
  selfAssessmentDocumentFormSchema,
  licenseSchemeSchema,
  pastikanKunciSesuaiSkema,
} from "./validators/self-assessment.validator";
export {
  LICENSE_SCHEMES,
  SCHEME_CATALOGS,
  autoParametersOf,
  catalogOf,
  manualParametersOf,
  parametersOf,
  type LicenseScheme,
  type ParameterBlock,
  type ParameterSpec,
  type SchemeCatalog,
} from "./domain/license-schemes";
