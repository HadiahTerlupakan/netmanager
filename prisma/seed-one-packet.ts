import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  const count = await prisma.hargaPaket.count()
  if (count > 0) {
    console.log('HargaPaket already exists, skipping seed.')
    return
  }

  // Need a ProfilePPP first?
  let profile = await prisma.profilePPP.findFirst()
  if (!profile) {
    profile = await prisma.profilePPP.create({
      data: {
        id: randomUUID(),
        name: 'default',
        localAddress: '192.168.1.1',
        remoteAddress: 'pool-default',
        dnsServer: '8.8.8.8',
        status: 'AKTIF',
        updatedAt: new Date()
      }
    })
    console.log('Created default ProfilePPP')
  }

  await prisma.hargaPaket.create({
    data: {
      id: randomUUID(),
      name: 'Default Package',
      harga: 100000,
      durasi: 30,
      durasiUnit: 'HARI',
      profilePPPId: profile.id,
      status: 'AKTIF',
      description: 'Auto-generated default package for sync',
      updatedAt: new Date()
    }
  })

  console.log('Created Default Package')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
