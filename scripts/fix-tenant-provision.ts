/**
 * Fix script: Provision data for existing tenant (PT.ANGIN RIBUT)
 * 
 * Usage: npx tsx scripts/fix-tenant-provision.ts
 */
import { prismaAuth } from '../lib/prisma'
import { provisionTenantData, getTenantAdminRoleId } from '../lib/tenant-provisioning'
import { MAIN_TENANT_ID } from '../lib/tenant-constants'

async function main() {
  console.log('🔧 Fixing tenant provisioning for existing tenants...\n')

  // Find all tenants except main
  const tenants = await (prismaAuth as any).tenant.findMany({
    where: { id: { not: MAIN_TENANT_ID } }
  })

  console.log(`Found ${tenants.length} non-main tenant(s):\n`)

  for (const tenant of tenants) {
    console.log(`\n━━━ Tenant: ${tenant.name} (${tenant.id}) ━━━`)

    // Check if already provisioned
    const existingRoles = await (prismaAuth as any).role.count({
      where: { tenantId: tenant.id }
    })

    if (existingRoles > 0) {
      console.log(`  ⚠️  Already has ${existingRoles} roles, skipping provisioning.`)
    } else {
      console.log(`  📦 Provisioning data...`)
      const result = await provisionTenantData(prismaAuth, tenant.id)
      console.log(`  ✅ Created: ${result.rolesCreated} roles, ${result.permissionsCreated} permissions, ${result.settingsCreated} settings`)
    }

    // Fix users pointing to main tenant roles
    const usersInTenant = await prismaAuth.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, roleId: true }
    })

    for (const user of usersInTenant) {
      if (!user.roleId) continue

      // Check if user's role belongs to a different tenant
      const userRole = await (prismaAuth as any).role.findUnique({
        where: { id: user.roleId },
        select: { id: true, name: true, tenantId: true }
      })

      if (userRole && userRole.tenantId !== tenant.id) {
        console.log(`  🔄 User "${user.name}" points to role "${userRole.name}" from tenant ${userRole.tenantId}`)
        
        // Find the equivalent role in this tenant
        const correctRole = await (prismaAuth as any).role.findFirst({
          where: { name: userRole.name, tenantId: tenant.id },
          select: { id: true }
        })

        if (correctRole) {
          await prismaAuth.user.update({
            where: { id: user.id },
            data: { roleId: correctRole.id }
          })
          console.log(`  ✅ Re-assigned to correct tenant role (${correctRole.id})`)
        } else {
          // Assign to admin role of this tenant
          const adminRoleId = await getTenantAdminRoleId(prismaAuth, tenant.id)
          if (adminRoleId) {
            await prismaAuth.user.update({
              where: { id: user.id },
              data: { roleId: adminRoleId }
            })
            console.log(`  ✅ Assigned to admin role (${adminRoleId}) as fallback`)
          } else {
            console.log(`  ❌ No suitable role found for user "${user.name}"`)
          }
        }
      }
    }
  }

  console.log('\n✅ Done!')
  await prismaAuth.$disconnect()
}

main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
