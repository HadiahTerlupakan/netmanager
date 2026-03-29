import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const res = await prisma.hargaPaket.create({
      data: {
        id: 'test-123',
        name: 'test',
        profilePPPId: 'test',
        harga: 1000,
        tenantId: 'some-tenant',
      } as any
    })
    console.log(res)
  } catch(e) {
    console.log(e)
  }
}
main()
