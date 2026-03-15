process.env.IS_SEEDING = 'true'
import { PrismaClient, Prisma } from '@prisma/client'
import { prismaAuth as prisma } from '../lib/prisma'
import { MAIN_TENANT_ID, MAIN_TENANT_NAME } from '../lib/tenant-constants'

async function main() {
  console.log('=============================================')
  console.log('🏗️  MULTI-TENANT DATA BACKFILL SCRIPT')
  console.log('=============================================')
  console.log(`Target Tenant: "${MAIN_TENANT_NAME}" (${MAIN_TENANT_ID})\n`)

  // 1. Ensure the Main Tenant exists with the correct ID and name
  let tenant = await prisma.tenant.findUnique({
    where: { id: MAIN_TENANT_ID }
  })

  if (!tenant) {
    // Check if tenant exists with the correct name but different ID
    const existingByName = await prisma.tenant.findFirst({
      where: { name: MAIN_TENANT_NAME }
    })

    if (existingByName) {
      // Update to use the canonical ID
      tenant = await prisma.tenant.update({
        where: { id: existingByName.id },
        data: { id: MAIN_TENANT_ID }
      })
      console.log(`♻️  Updated existing tenant "${MAIN_TENANT_NAME}" to canonical ID: ${MAIN_TENANT_ID}`)
    } else {
      tenant = await prisma.tenant.create({
        data: {
          id: MAIN_TENANT_ID,
          name: MAIN_TENANT_NAME,
        }
      })
      console.log(`✨ Created new tenant: ${MAIN_TENANT_NAME} (${MAIN_TENANT_ID})`)
    }
  } else {
    // Ensure the name is correct
    if (tenant.name !== MAIN_TENANT_NAME) {
      await prisma.tenant.update({
        where: { id: MAIN_TENANT_ID },
        data: { name: MAIN_TENANT_NAME }
      })
      console.log(`♻️  Renamed tenant from "${tenant.name}" to "${MAIN_TENANT_NAME}"`)
    } else {
      console.log(`✅ Tenant "${MAIN_TENANT_NAME}" already exists with correct ID`)
    }
  }

  // 2. Merge any legacy tenants ("Main Tenant", "Radpro Network", etc.) into NETMANAGER
  const legacyTenantNames = ['Main Tenant', 'Radpro Network', 'Default Tenant']
  for (const legacyName of legacyTenantNames) {
    const legacyTenant = await prisma.tenant.findFirst({
      where: { name: legacyName }
    })
    if (legacyTenant && legacyTenant.id !== MAIN_TENANT_ID) {
      console.log(`\n🔄 Merging legacy tenant "${legacyName}" (${legacyTenant.id}) into "${MAIN_TENANT_NAME}"...`)
      
      // Re-assign all data from legacy tenant to NETMANAGER
      const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter(model =>
        model.fields.some(f => f.name === 'tenantId')
      )

      let mergedCount = 0
      for (const model of modelsWithTenantId) {
        const delegateProp = model.name.charAt(0).toLowerCase() + model.name.slice(1)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delegate = (prisma as any)[delegateProp]
        if (delegate && delegate.updateMany) {
          try {
            const result = await delegate.updateMany({
              where: { tenantId: legacyTenant.id },
              data: { tenantId: MAIN_TENANT_ID }
            })
            if (result.count > 0) {
              console.log(`   ✅ [${model.name.padEnd(25)}] Migrated ${result.count} records`)
              mergedCount += result.count
            }
          } catch (e) {
            const err = e as Error
            console.error(`   ❌ [${model.name.padEnd(25)}] Failed: ${err.message.split('\n')[0]}`)
          }
        }
      }

      // Delete the empty legacy tenant
      if (mergedCount >= 0) {
        try {
          await prisma.tenant.delete({ where: { id: legacyTenant.id } })
          console.log(`   🗑️  Deleted empty legacy tenant "${legacyName}"`)
        } catch {
          console.log(`   ⚠️  Could not delete legacy tenant "${legacyName}" (may still have references)`)
        }
      }
    }
  }

  // 3. Backfill any remaining orphaned records (tenantId is null)
  const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter(model =>
    model.fields.some(f => f.name === 'tenantId')
  )

  console.log(`\n🔍 Found ${modelsWithTenantId.length} database tables that require 'tenantId'.`)
  console.log('⚙️  Backfilling orphaned records (tenantId = null)...\n')

  let totalUpdated = 0
  let tablesAffected = 0

  for (const model of modelsWithTenantId) {
    const modelName = model.name
    const delegateProp = modelName.charAt(0).toLowerCase() + modelName.slice(1)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[delegateProp]

    if (delegate && delegate.updateMany) {
      try {
        const result = await delegate.updateMany({
          where: { tenantId: null },
          data: { tenantId: MAIN_TENANT_ID }
        })

        if (result.count > 0) {
          console.log(`✅ [${modelName.padEnd(25)}] Updated ${result.count} orphaned records`)
          totalUpdated += result.count
          tablesAffected++
        }
      } catch (e) {
        const err = e as Error
        console.error(`❌ [${modelName.padEnd(25)}] Failed: ${err.message.split('\n')[0]}`)
      }
    }
  }

  console.log('\n=============================================')
  console.log('🎉 BACKFILL COMPLETE!')
  console.log('=============================================')
  console.log(`📊 Total tables updated : ${tablesAffected}`)
  console.log(`📊 Total rows updated   : ${totalUpdated}`)
  console.log(`🔑 Assigned Tenant ID   : ${MAIN_TENANT_ID}`)
  console.log(`🏢 Tenant Name          : ${MAIN_TENANT_NAME}`)
  console.log('=============================================')
}

main()
  .catch(e => {
    console.error('Fatal Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
