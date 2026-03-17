
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}

const pool = new Pool({
  connectionString,
  max: 1,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function cleanTestData() {
  console.log('--- Memulai Pembersihan Data Pengujian Fase 3 ---')

  const testTenants = await prisma.tenant.findMany({
    where: {
      id: { startsWith: 'test-tenant-' }
    }
  })

  console.log(`Ditemukan ${testTenants.length} tenant pengujian.`)

  for (const tenant of testTenants) {
    console.log(`Membersihkan data untuk tenant: ${tenant.id}...`)
    
    // Hapus data terkait menggunakan query raw atau filter manual jika model butuh tenantId
    // Karena kita pakai @prisma/client dasar, tenantId harus disertakan manual (tidak ada ekstensi)
    await prisma.shift.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.coupon.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.purchaseRequest.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.acsWifiSecurity.deleteMany({ where: { tenantId: tenant.id } })
    
    // Akhirnya hapus tenant itu sendiri
    await prisma.tenant.delete({ where: { id: tenant.id } })
    console.log(`✓ Tenant ${tenant.id} dan datanya berhasil dihapus.`)
  }

  console.log('--- Pembersihan Selesai ---')
}

cleanTestData()
  .catch(e => {
    console.error('Gagal membersihkan data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
