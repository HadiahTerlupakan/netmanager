import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function checkAndCreateAdminUser() {
    try {
        console.log('🔍 Checking for ADMIN/FINANCE users...')

        // Check existing users with ADMIN or FINANCE role
        const adminUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'ADMIN' },
                    { role: 'FINANCE' },
                ],
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        })

        console.log(`\nFound ${adminUsers.length} admin/finance users:`)
        adminUsers.forEach((user) => {
            console.log(`  - ${user.email} (${user.role}) - ID: ${user.id}`)
        })

        if (adminUsers.length === 0) {
            console.log('\n⚠️  No ADMIN/FINANCE users found!')
            console.log('Creating default admin user...\n')

            const passwordHash = await hash('admin123', 10)

            const adminUser = await prisma.user.create({
                data: {
                    email: 'admin@netmanager.local',
                    name: 'Administrator',
                    passwordHash,
                    role: 'ADMIN',
                },
            })

            console.log('✅ Admin user created successfully!')
            console.log(`   Email: ${adminUser.email}`)
            console.log(`   Password: admin123`)
            console.log(`   ID: ${adminUser.id}`)
        } else {
            console.log('\n✅ Admin users already exist')
            console.log('\nYou can login with one of the users above.')
            console.log('If you forgot the password, you can reset it manually.')
        }

        console.log('\n🔐 Login URL: http://finance.localhost:3000/finance/login')
    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkAndCreateAdminUser()
