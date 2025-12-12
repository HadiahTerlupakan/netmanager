import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAndCreateAdminUser() {
    try {
        console.log('🔍 Checking for admin users with CustomRole...')

        // Check employees with Administrator custom role
        const adminEmployees = await prisma.employee.findMany({
            where: {
                customRoles: {
                    some: {
                        role: {
                            code: {
                                in: ['ADMINISTRATOR', 'ADMIN']
                            },
                            isActive: true
                        }
                    }
                }
            },
            include: {
                customRoles: {
                    include: {
                        role: {
                            select: {
                                name: true,
                                code: true,
                            }
                        }
                    }
                }
            }
        })

        console.log(`\nFound ${adminEmployees.length} admin users:`)
        adminEmployees.forEach((emp) => {
            const roles = emp.customRoles.map(r => r.role.name).join(', ')
            console.log(`  - ${emp.email || emp.fullName} (${roles}) - Employee ID: ${emp.employeeId}`)
        })

        if (adminEmployees.length === 0) {
            console.log('\n⚠️  No admin users found!')
            console.log('Please run "npm run db:seed" to create an admin user.')
            console.log('\nAlternatively, you can:')
            console.log('1. Create a user via the registration form')
            console.log('2. Create a CustomRole with Administrator permissions')
            console.log('3. Assign the role to the employee')
        } else {
            console.log('\n✅ Admin users exist')
            console.log('\nYou can login with one of the users above.')
        }

        console.log('\n🔐 Login URL: http://admin.localhost:3000/admin/login')
        console.log('            http://finance.localhost:3000/finance/login')
    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkAndCreateAdminUser()
