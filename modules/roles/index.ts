// Public API for Roles Module
export { RoleRepository } from './repositories/RoleRepository'
export type {
    CreateRoleDTO,
    UpdateRoleDTO,
    RoleWithPermissions,
    RoleWithCount,
    FilterOptions
} from './repositories/RoleRepository'

export { RoleService, getRoleService } from './services/RoleService'

// Site Management
export { SiteRepository } from './repositories/SiteRepository'
export { SiteService } from './services/SiteService'

// Site Restriction (RBAC) helpers
export {
    checkSiteRestriction,
    getSiteFilter,
    getSiteFilters,           // Multi-site: get array of siteIds
    buildMultiSiteWhereClause, // Multi-site: Prisma where clause
    canAccessSite,
    validateSiteAccess,
    buildSiteWhereClause,
    getPrimarySiteId,         // Multi-site: get primary site
    getUserSiteIds            // Multi-site: get all user sites
} from './services/SiteRestrictionService'
export type { SiteRestrictionResult } from './services/SiteRestrictionService'

