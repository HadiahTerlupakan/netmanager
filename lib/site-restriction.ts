/**
 * Site Restriction Helper
 * 
 * @deprecated Import langsung dari '@/modules/roles' untuk konsistensi:
 * ```typescript
 * import { checkSiteRestriction, getSiteFilter, canAccessSite } from '@/modules/roles'
 * ```
 * 
 * File ini tetap di-maintain untuk backward compatibility.
 */

// Re-export from modules/roles for backward compatibility
export {
    checkSiteRestriction,
    getSiteFilter,
    canAccessSite,
    validateSiteAccess,
    buildSiteWhereClause
} from '@/modules/roles'
export type { SiteRestrictionResult } from '@/modules/roles'
