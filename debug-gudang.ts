
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        where: { id: 'cmj9udk280021n9jlee1ex83u' },
        select: {
            id: true,
            name: true,
            siteId: true,
            role: { select: { name: true, permissions: true } }
        }
    })

    console.log('User Details:')
    console.dir(users, { depth: null })

    const site = await prisma.site.findUnique({
        where: { id: users[0]?.siteId || 'dummy' },
        select: { id: true, name: true }
    })
    console.log('User Site:', site)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
