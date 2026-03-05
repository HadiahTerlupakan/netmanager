import { prisma } from './lib/prisma'

async function main() {
    const users = await prisma.user.findMany({
        where: { email: 'admin@example.com' },
        include: { role: true }
    })

    if (users.length > 0) {
        const adminRole = users[0].role
        console.log('Admin Role Name:', adminRole?.name)
        console.log('Admin Role isRestricted:', adminRole?.isRestricted)

        // permissions are usually stored in Role.permissions or RolePermission pivot
        // let's check schema for permissions
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
