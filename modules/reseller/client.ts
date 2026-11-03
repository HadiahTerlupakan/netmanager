/**
 * Public API modul reseller untuk komponen klien.
 *
 * Hanya konstanta dan fungsi murni — tanpa service/repository — sehingga aman
 * diimpor dari client component tanpa menarik Prisma ke bundle browser.
 *
 * Client component: `import { ... } from "@/modules/reseller/client"`
 * Server/API route: `import { ... } from "@/modules/reseller"` (barrel penuh)
 */

export {
  RESELLER_COMPLIANCE_SETTING_PERMISSIONS,
  requiresStatusReason,
} from "./domain/reseller-compliance";
export { RESELLER_FINANCE_PERMISSIONS } from "./domain/reseller-finance-permissions";
export {
  MAX_COMMISSION_PERCENT,
  MAX_FIXED_COMMISSION,
  MIN_COMMISSION_PERCENT,
  MIN_FIXED_COMMISSION,
} from "./validators/reseller-commission-rule";
