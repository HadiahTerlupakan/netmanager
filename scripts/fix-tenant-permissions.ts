import { prismaAuth } from '../lib/prisma'
import { provisionTenantData, getTenantAdminRoleId } from '../modules/mitra/services/TenantProvisioningService'
import { randomUUID } from 'crypto'

async function main() {
    const { MAIN_TENANT_ID } = await import('../modules/mitra/services/tenant-constants')
    
    const tenants = await prismaAuth.tenant.findMany({
        where: {
            id: { not: MAIN_TENANT_ID }
        }
    })

    console.log(`Found ${tenants.length} tenants to fix...`)

    for (const tenant of tenants) {
        console.log(`\n--- Fixing tenant: ${tenant.name} (${tenant.id}) ---`)
        
        // 1. Provision permissions if missing
        const provResult = await provisionTenantData(prismaAuth, tenant.id)
        console.log(`   Provisioned: ${provResult.permissionsCreated} permissions, ${provResult.rolesCreated} roles`)

        // 2. Fix existing roles that have 0 permissions
        const roles = await prismaAuth.role.findMany({
            where: { tenantId: tenant.id },
            include: { permission: true }
        })

        console.log(`   Checking ${roles.length} roles...`)

        for (const role of roles) {
            if (role.permission.length === 0) {
                console.log(`   Role "${role.name}" has 0 permissions. Connecting now...`)
                
                // If it's ADMIN, give it everything from the tenant
                if (role.name.toUpperCase() === 'ADMIN') {
                    const allTenantPerms = await prismaAuth.permission.findMany({
                        where: { tenantId: tenant.id },
                        select: { id: true }
                    })
                    
                    await prismaAuth.role.update({
                        where: { id: role.id },
                        data: {
                            permission: {
                                connect: allTenantPerms.map(p => ({ id: p.id }))
                            }
                        }
                    })
                    console.log(`      ✅ Connected ${allTenantPerms.length} permissions to role: ${role.name}`)
                } 
                // Otherwise, try to find permissions from the main tenant's equivalent role
                else {
                    const mainRole = await prismaAuth.role.findFirst({
                        where: { name: role.name, tenantId: MAIN_TENANT_ID },
                        include: { permission: true }
                    })

                    if (mainRole) {
                        const tenantPerms = await prismaAuth.permission.findMany({
                            where: {
                                tenantId: tenant.id,
                                OR: mainRole.permission.map(p => ({
                                    resource: p.resource,
                                    action: p.action
                                }))
                            },
                            select: { id: true }
                        })

                        await prismaAuth.role.update({
                            where: { id: role.id },
                            data: {
                                permission: {
                                    connect: tenantPerms.map(p => ({ id: p.id }))
                                }
                            }
                        })
                        console.log(`      ✅ Connected ${tenantPerms.length} permissions to role: ${role.name} based on main tenant`)
                    }
                }
            } else {
                console.log(`   Role "${role.name}" already has ${role.permission.length} permissions.`)
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => process.exit(0))
