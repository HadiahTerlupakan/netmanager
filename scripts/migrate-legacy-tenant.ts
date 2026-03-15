import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

/**
 * Script ini bersifat IDEMPOTENT (aman dijalankan berkali-kali).
 * Digunakan dalam CI/CD untuk memastikan tenant NETMANAGER ada dan data legacy tertaut.
 */

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('❌ DATABASE_URL tidak ditemukan di .env')
    return
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  console.log('🚀 Checking/Migrating legacy data for NETMANAGER...')

  try {
    // 1. Pastikan Tenant NETMANAGER ada
    const tenantName = 'NETMANAGER'
    const targetTenantId = '0c33470a-0a95-4770-b083-a52598c490a3' // ID Konsisten
    
    let tenant = await prisma.tenant.findUnique({
      where: { id: targetTenantId }
    })

    if (!tenant) {
      console.log(`🏢 Creating main tenant: ${tenantName} (${targetTenantId})...`)
      tenant = await prisma.tenant.create({
        data: {
          id: targetTenantId,
          name: tenantName,
          isActive: true
        }
      })
    } else {
      console.log(`✅ Tenant ${tenantName} already exists.`)
    }

    // 2. Daftar model yang perlu di-backfill (tenantId is null)
    const modelsToUpdate = [
      'User', 'Departments', 'Sites', 'Position', 'Gudang', 
      'Role', 'Permission', 'Investor', 'FinancialAccount', 
      'MapSettings', 'MappingNode', 'MappingEdge', 'Barang', 
      'KategoriBarang', 'SatuanBarang', 'Vendor'
    ]

    for (const modelName of modelsToUpdate) {
      try {
        const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1)
        // @ts-ignore
        const delegate = prisma[delegateName]
        
        if (delegate && delegate.updateMany) {
          const result = await delegate.updateMany({
            where: { tenantId: null },
            data: { tenantId: targetTenantId }
          })
          if (result.count > 0) {
            console.log(`🔹 ${modelName}: Updated ${result.count} records.`)
          }
        }
      } catch (err) {
        // Skip models that might not exist in some environments
      }
    }

    console.log('✨ CI/CD Migration Step Complete.')
  } catch (error) {
    console.error('❌ Migration Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
