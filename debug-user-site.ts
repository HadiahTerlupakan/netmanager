
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Debugging teknisi@example.com ---')
    const user = await prisma.user.findUnique({
        where: { email: 'teknisi@example.com' },
        select: {
            id: true,
            name: true,
            email: true,
            siteId: true
        }
    })
    console.log('User:', user)

    if (user?.siteId) {
        const site = await prisma.site.findUnique({
            where: { id: user.siteId },
            select: { id: true, name: true }
        })
        console.log('Assigned Site (DB):', site)
    }

    console.log('\n--- Debugging Site: CARIU ---')
    const cariuSite = await prisma.site.findFirst({
        where: { name: { contains: 'CARIU', mode: 'insensitive' } },
        select: { id: true, name: true }
    })
    console.log('Cariu Site:', cariuSite)

    if (cariuSite) {
        const gudangs = await prisma.gudang.findMany({
            where: { siteId: cariuSite.id },
            select: { id: true, nama: true, siteId: true }
        })
        console.log('Gudangs in Cariu Site:', gudangs)
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
