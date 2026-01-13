
import { prisma } from '../lib/prisma'

async function main() {
    const userName = 'Muhamad Dede Rakhamattulah'
    const user = await prisma.user.findFirst({
        where: { name: { contains: userName, mode: 'insensitive' } }
    })

    if (!user) {
        console.log(`User ${userName} not found`)
        return
    }

    console.log(`User Found: ${user.name} (${user.id})`)

    // Check ALL Overtime Records
    const allOvertimes = await prisma.overtime.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } }
    })

    console.log('--- GLOBAL Overtime Records (Top 5) ---')
    console.log(JSON.stringify(allOvertimes, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
