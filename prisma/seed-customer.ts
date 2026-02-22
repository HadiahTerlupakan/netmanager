import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding customer...')

  // 1. Get or create Site
  let site = await prisma.sites.findFirst()
  if (!site) {
    site = await prisma.sites.create({
      data: {
        id: randomUUID(),
        code: 'SITE01',
        name: 'Default Site',
        updatedAt: new Date()
      }
    })
    console.log('Created Site:', site.name)
  }

  // 2. Get or create ProfilePPP
  let profile = await prisma.profilePPP.findFirst()
  if (!profile) {
    profile = await prisma.profilePPP.create({
      data: {
        id: randomUUID(),
        name: 'Default Profile',
        localAddress: '192.168.1.1',
        remoteAddress: 'pool1',
        status: 'AKTIF',
        updatedAt: new Date()
      }
    })
    console.log('Created ProfilePPP:', profile.name)
  }

  // 3. Get or create HargaPaket
  let hargaPaket = await prisma.hargaPaket.findFirst()
  if (!hargaPaket) {
    hargaPaket = await prisma.hargaPaket.create({
      data: {
        id: randomUUID(),
        name: 'Package 10Mbps',
        harga: 150000,
        durasi: 30,
        durasiUnit: 'HARI',
        profilePPPId: profile.id,
        status: 'AKTIF',
        updatedAt: new Date()
      }
    })
    console.log('Created HargaPaket:', hargaPaket.name)
  }

  const idPelanggan = '88888888'
  const plainPassword = 'customer123'
  const passwordHash = await hash(plainPassword, 12)

  // 4. Upsert Pelanggan
  const pelanggan = await prisma.pelanggan.upsert({
    where: { idPelanggan },
    update: {
      passwordHash: passwordHash,
      status: 'AKTIF'
    },
    create: {
      id: randomUUID(),
      idPelanggan,
      nama: 'Test Customer',
      username: 'testcustomer',
      password: plainPassword, // This is often used for PPP password
      passwordHash: passwordHash,
      hargaPaketId: hargaPaket.id,
      siteId: site.id,
      status: 'AKTIF',
      tanggalAktif: new Date(),
      jatuhTempo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    }
  })

  console.log('✅ Pelanggan seeded:', pelanggan.idPelanggan)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
