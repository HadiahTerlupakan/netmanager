import { prisma } from './lib/prisma'

async function check() {
    const c = await prisma.pelanggan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { nama: true, jatuhTempo: true, createdAt: true }
    })
    console.log(c)
}

check().catch(console.error).finally(() => prisma.$disconnect())
