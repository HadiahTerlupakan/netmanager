import { prisma } from './lib/prisma'

async function test() {
    try {
        const salesUsers = await prisma.user.findMany({
            where: {
                isSales: true,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                canvasingTarget: true,
                targetSchema: true,
                departments: {
                    select: { name: true }
                },
                sites: {
                    select: { code: true, name: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })
        console.log('Success! Found', salesUsers.length, 'users')
        console.log('First user targetSchema:', salesUsers[0]?.targetSchema)
    } catch (error) {
        console.error('Error during prisma query:', error)
    }
}

test()
