import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { MAIN_TENANT_ID } from './tenant-constants'

/**
 * Provision default data for a newly created tenant.
 * Clones essential Roles, Permissions, and Settings from the main tenant.
 * 
 * @param prismaClient - Unfiltered Prisma client (prismaAuth, NOT prisma with tenant isolation)
 * @param tenantId - The ID of the newly created tenant
 */
export async function provisionTenantData(
  prismaClient: PrismaClient,
  tenantId: string
): Promise<{ rolesCreated: number; permissionsCreated: number; settingsCreated: number }> {
  // ── 1. Clone ALL Permissions ────────────────────────────────────────
  // We MUST clone all permissions first so they exist for the new tenant
  const mainPermissions = await prismaClient.permission.findMany({
    where: { tenantId: MAIN_TENANT_ID }
  })

  let permissionsCreated = 0
  for (const perm of mainPermissions) {
    const existingPerm = await prismaClient.permission.findFirst({
      where: { resource: perm.resource, action: perm.action, tenantId }
    })

    if (!existingPerm) {
      await prismaClient.permission.create({
        data: {
          id: randomUUID(),
          name: perm.name,
          action: perm.action,
          resource: perm.resource,
          description: perm.description,
          tenantId,
          updatedAt: new Date()
        }
      })
      permissionsCreated++
    }
  }

  // ── 2. Clone Roles ──────────────────────────────────────────────────
  const mainRoles = await prismaClient.role.findMany({
    where: { 
      tenantId: MAIN_TENANT_ID,
      isSuperAdmin: false // Don't clone Super Admin roles to sub-tenants
    },
    include: {
      permission: { select: { resource: true, action: true } }
    }
  })

  // Map old role ID -> new role ID (for user re-assignment later)
  const roleIdMap = new Map<string, string>()

  for (const role of mainRoles) {
    const newRoleId = randomUUID()
    roleIdMap.set(role.id, newRoleId)

    // Find the newly created permissions for this tenant that match the original role's permissions
    const tenantPermissions = await prismaClient.permission.findMany({
      where: {
        tenantId,
        OR: role.permission.map(p => ({
          resource: p.resource,
          action: p.action
        }))
      },
      select: { id: true }
    })

    // Create the role for the new tenant
    await prismaClient.role.create({
      data: {
        id: newRoleId,
        name: role.name,
        description: role.description,
        accessAdminPanel: role.accessAdminPanel, 
        accessEmployeePanel: role.accessEmployeePanel,
        isRestricted: role.isRestricted,
        isTechnical: role.isTechnical,
        isSuperAdmin: false, // Force isSuperAdmin to false for all tenant-level roles
        canApproveRab: role.canApproveRab,
        tenantId,
        updatedAt: new Date(),
        permission: {
          connect: tenantPermissions.map(p => ({ id: p.id }))
        }
      }
    })
  }

  // ── 3. Ensure Admin Role Exists ────────────────────────────────────
  // If no admin role was cloned, create a default 'ADMIN' role
  const existingAdmin = await getTenantAdminRoleId(prismaClient, tenantId)
  if (!existingAdmin) {
    const adminRoleId = randomUUID()
    
    // Find all permissions created for this tenant to give them to the new admin
    const tenantPermissions = await prismaClient.permission.findMany({
      where: { tenantId },
      select: { id: true }
    })

    await prismaClient.role.create({
      data: {
        id: adminRoleId,
        name: 'ADMIN',
        description: 'Administrator dengan akses penuh (Auto-generated)',
        accessAdminPanel: true, // MUST be true for admin
        accessEmployeePanel: true,
        isRestricted: true,
        isTechnical: false,
        isSuperAdmin: false,
        canApproveRab: true,
        tenantId,
        updatedAt: new Date(),
        permission: {
          connect: tenantPermissions.map(p => ({ id: p.id }))
        }
      }
    })
    console.log(`[TENANT_PROVISION] Created default ADMIN role for tenant ${tenantId}`)
  }

  // ── 4. Clone Settings (non-encrypted only) ──────────────────────────
  const mainSettings = await prismaClient.settings.findMany({
    where: { tenantId: MAIN_TENANT_ID, encrypted: false }
  })

  // Filter sensitive keys that should not be cloned
  const sensitiveKeys = [
    'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL',
    'GOOGLE_GEMINI_API_KEY', 'captcha_secret_key', 'captcha_site_key'
  ]

  let settingsCreated = 0
  for (const setting of mainSettings) {
    if (sensitiveKeys.includes(setting.key)) continue

    const existing = await prismaClient.settings.findFirst({
      where: { key: setting.key, tenantId }
    })

    if (!existing) {
      await prismaClient.settings.create({
        data: {
          id: randomUUID(),
          key: setting.key,
          value: setting.value,
          encrypted: false,
          description: setting.description,
          tenantId,
          updatedAt: new Date()
        }
      })
      settingsCreated++
    }
  }

  console.log(`[TENANT_PROVISION] Provisioned tenant ${tenantId}: ${mainRoles.length} roles, ${permissionsCreated} permissions, ${settingsCreated} settings`)

  return {
    rolesCreated: mainRoles.length,
    permissionsCreated,
    settingsCreated
  }
}

/**
 * Get the admin role ID for a given tenant.
 * Returns the role with isSuperAdmin=true, or the first role with accessAdminPanel=true.
 */
export async function getTenantAdminRoleId(
  prismaClient: PrismaClient,
  tenantId: string
): Promise<string | null> {
  // Prefer SUPER_ADMIN role
  const superAdminRole = await prismaClient.role.findFirst({
    where: { tenantId, isSuperAdmin: true },
    select: { id: true }
  })
  if (superAdminRole) return superAdminRole.id

  // Fallback to any admin role
  const adminRole = await prismaClient.role.findFirst({
    where: { tenantId, accessAdminPanel: true },
    select: { id: true }
  })
  return adminRole?.id || null
}

