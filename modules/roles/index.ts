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
