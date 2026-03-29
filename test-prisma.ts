import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type HargaPaketCreateData = NonNullable<Parameters<typeof prisma.hargaPaket.create>[0]>['data']

async function main() {
  try {
    const res = await prisma.hargaPaket.create({
      data: {
        id: 'test-123',
        name: 'test',
        profilePPPId: 'test',
        harga: 1000,
        tenantId: 'some-tenant',
      } as HargaPaketCreateData
    })
    console.log(res)
  } catch(e) {
    console.log(e)
  }
}
main()
