process.env.IS_SEEDING = 'true'
import { prisma } from './lib/prisma'

async function main() {
  const id = 'cmjicz7ic000ong1geu3l6rlt'
  try {
    const barang = await prisma.barang.findUnique({
      where: { id },
      include: { tenant: true }
    })
    
    if (barang) {
      console.log('SUCCESS: Barang found')
      console.log('ID:', barang.id)
      console.log('Nama:', barang.nama)
      console.log('Tenant:', barang.tenant?.name || barang.tenantId)
    } else {
      console.log('FAILED: Barang NOT found with ID:', id)
      
      // Try to find any barang to see if connection works
      const count = await prisma.barang.count()
      console.log('Total barang in DB:', count)
    }
  } catch (error) {
    console.error('ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
