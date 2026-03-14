process.env.IS_SEEDING = 'true'
import { PrismaClient, Prisma } from '@prisma/client'
import { prismaAuth as prisma } from '../lib/prisma'

async function main() {
  const args = process.argv.slice(2)
  const tenantName = args.length > 0 ? args.join(' ') : 'Default Tenant'
  
  console.log('=============================================')
  console.log('🏗️  MULTI-TENANT DATA BACKFILL SCRIPT')
  console.log('=============================================')
  console.log(`Target Tenant Name: "${tenantName}"\n`)

  // 1. Get or Create the Tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: tenantName }
  })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
      }
    })
    console.log(`✨ Created new tenant profile: ${tenant.id}`)
  } else {
    console.log(`♻️  Using existing tenant profile: ${tenant.id}`)
  }

  // 2. Use Prisma Reflection (DMMF) to find all models that have a `tenantId` field
  const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter(model =>
    model.fields.some(f => f.name === 'tenantId')
  )

  console.log(`\n🔍 Found ${modelsWithTenantId.length} database tables that require 'tenantId'.`)
  console.log('⚙️  Starting backfill process...\n')

  let totalUpdated = 0
  let tablesAffected = 0

  // 3. Iterate through all models and update records where `tenantId` is null
  for (const model of modelsWithTenantId) {
    const modelName = model.name
    // Prisma client delegates start with lowercase (e.g., 'User' -> 'user')
    const delegateProp = modelName.charAt(0).toLowerCase() + modelName.slice(1)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[delegateProp]

    if (delegate && delegate.updateMany) {
      try {
        const result = await delegate.updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id }
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
  console.log(`🔑 Assigned Tenant ID   : ${tenant.id}`)
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
