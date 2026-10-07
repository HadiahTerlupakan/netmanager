/**
 * Public API modul regulatory untuk komponen klien.
 *
 * Hanya berisi tipe, konstanta, dan fungsi murni — TIDAK meng-export service
 * atau repository, sehingga aman diimpor dari client component tanpa menarik
 * Prisma ke bundle browser.
 *
 * Client component: `import { ... } from "@/modules/regulatory/client"`
 * Server/API route: `import { ... } from "@/modules/regulatory"` (barrel penuh)
 */

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
