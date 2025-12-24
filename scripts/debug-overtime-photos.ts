
import { prisma } from '../lib/prisma'

async function main() {
    console.log('Fetching latest 5 overtime records...')
    const overtimes = await prisma.overtime.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            status: true,
            startPhoto: true,
            endPhoto: true,
            user: { select: { name: true } }
        }
    })

    console.log(JSON.stringify(overtimes, null, 2))
}

main()
