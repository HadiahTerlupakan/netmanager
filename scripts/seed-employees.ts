import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

async function seedEmployees() {
    console.log('👥 Seeding employees...\n')

    try {
        // 1. Create Departments
        console.log('📂 Creating departments...')
        const departments = [
            { name: 'IT', description: 'Information Technology' },
            { name: 'HRD', description: 'Human Resources' },
            { name: 'Finance', description: 'Finance & Accounting' },
            { name: 'Marketing', description: 'Marketing & Sales' },
            { name: 'Operations', description: 'Operations & Support' },
        ]

        for (const dept of departments) {
            await prisma.department.upsert({
                where: { name: dept.name },
                update: {},
                create: dept,
            })
            console.log(`  ✓ Department: ${dept.name}`)
        }

        // 2. Create Positions
        console.log('\n💼 Creating positions...')
        const positions = [
            { title: 'CEO', description: 'Chief Executive Officer', level: 'Executive' },
            { title: 'Manager', description: 'Department Manager', level: 'Manager' },
            { title: 'Supervisor', description: 'Team Supervisor', level: 'Supervisor' },
            { title: 'Senior Staff', description: 'Senior Staff', level: 'Senior' },
            { title: 'Staff', description: 'Staff', level: 'Mid' },
            { title: 'Junior Staff', description: 'Junior Staff', level: 'Junior' },
        ]

        for (const pos of positions) {
            await prisma.position.upsert({
                where: { title: pos.title },
                update: {},
                create: pos,
            })
            console.log(`  ✓ Position: ${pos.title}`)
        }

        // Get created departments and positions
        const itDept = await prisma.department.findUnique({ where: { name: 'IT' } })
        const hrdDept = await prisma.department.findUnique({ where: { name: 'HRD' } })
        const financeDept = await prisma.department.findUnique({ where: { name: 'Finance' } })
        const marketingDept = await prisma.department.findUnique({ where: { name: 'Marketing' } })
        const operationsDept = await prisma.department.findUnique({ where: { name: 'Operations' } })

        const managerPos = await prisma.position.findUnique({ where: { title: 'Manager' } })
        const seniorStaffPos = await prisma.position.findUnique({ where: { title: 'Senior Staff' } })
        const staffPos = await prisma.position.findUnique({ where: { title: 'Staff' } })
        const juniorStaffPos = await prisma.position.findUnique({ where: { title: 'Junior Staff' } })

        // Ensure all departments exist
        if (!itDept || !hrdDept || !financeDept || !marketingDept || !operationsDept) {
            throw new Error('One or more departments not found')
        }

        if (!managerPos || !seniorStaffPos || !staffPos || !juniorStaffPos) {
            throw new Error('One or more positions not found')
        }

        // 3. Create Employees with User Accounts
        console.log('\n👤 Creating employees...')

        const employees = [
            {
                employeeId: 'EMP-001',
                fullName: 'Ahmad Hidayat',
                email: 'ahmad.hidayat@netmanager.com',
                phone: '081234567001',
                dateOfBirth: new Date('1990-01-15'),
                gender: 'MALE',
                address: 'Jl. Merdeka No. 123',
                city: 'Jakarta',
                province: 'DKI Jakarta',
                departmentId: itDept.id,
                positionId: managerPos.id,
                employmentStatus: 'PERMANENT',
                joinDate: new Date('2020-01-01'),
                emergencyName: 'Siti Nurhaliza',
                emergencyPhone: '081234567999',
                emergencyRelation: 'Istri',
                password: 'password123',
            },
            {
                employeeId: 'EMP-002',
                fullName: 'Siti Rahmawati',
                email: 'siti.rahmawati@netmanager.com',
                phone: '081234567002',
                dateOfBirth: new Date('1992-03-20'),
                gender: 'FEMALE',
                address: 'Jl. Sudirman No. 456',
                city: 'Bandung',
                province: 'Jawa Barat',
                departmentId: hrdDept.id,
                positionId: seniorStaffPos.id,
                employmentStatus: 'PERMANENT',
                joinDate: new Date('2021-06-15'),
                emergencyName: 'Budi Rahmawan',
                emergencyPhone: '081234567998',
                emergencyRelation: 'Suami',
                password: 'password123',
            },
            {
                employeeId: 'EMP-003',
                fullName: 'Budi Santoso',
                email: 'budi.santoso@netmanager.com',
                phone: '081234567003',
                dateOfBirth: new Date('1995-05-10'),
                gender: 'MALE',
                address: 'Jl. Gatot Subroto No. 789',
                city: 'Surabaya',
                province: 'Jawa Timur',
                departmentId: financeDept.id,
                positionId: staffPos.id,
                employmentStatus: 'PERMANENT',
                joinDate: new Date('2022-03-01'),
                emergencyName: 'Sri Santoso',
                emergencyPhone: '081234567997',
                emergencyRelation: 'Ibu',
                password: 'password123',
            },
            {
                employeeId: 'EMP-004',
                fullName: 'Dewi Lestari',
                email: 'dewi.lestari@netmanager.com',
                phone: '081234567004',
                dateOfBirth: new Date('1998-08-25'),
                gender: 'FEMALE',
                address: 'Jl. Ahmad Yani No. 321',
                city: 'Medan',
                province: 'Sumatera Utara',
                departmentId: marketingDept.id,
                positionId: juniorStaffPos.id,
                employmentStatus: 'PROBATION',
                joinDate: new Date('2024-01-15'),
                probationEndDate: new Date('2024-04-15'),
                emergencyName: 'Agus Lestari',
                emergencyPhone: '081234567996',
                emergencyRelation: 'Ayah',
                password: 'password123',
            },
            {
                employeeId: 'EMP-005',
                fullName: 'Rizki Pratama',
                email: 'rizki.pratama@netmanager.com',
                phone: '081234567005',
                dateOfBirth: new Date('1993-11-30'),
                gender: 'MALE',
                address: 'Jl. Diponegoro No. 654',
                city: 'Semarang',
                province: 'Jawa Tengah',
                departmentId: operationsDept.id,
                positionId: staffPos.id,
                employmentStatus: 'PERMANENT',
                joinDate: new Date('2021-09-01'),
                emergencyName: 'Indah Pratama',
                emergencyPhone: '081234567995',
                emergencyRelation: 'Istri',
                password: 'password123',
            },
        ]

        for (const emp of employees) {
            // Check if employee already exists
            const existingEmployee = await prisma.employee.findUnique({
                where: { employeeId: emp.employeeId },
            })

            if (existingEmployee) {
                console.log(`  ⏭️  Employee ${emp.employeeId} (${emp.fullName}) already exists, skipping...`)
                continue
            }

            // Create User account first
            const passwordHash = await hash(emp.password, 10)
            const user = await prisma.user.create({
                data: {
                    email: emp.email,
                    name: emp.fullName,
                    passwordHash,
                    role: 'USER', // Default role for employees
                },
            })

            // Create Employee record
            const { password, ...employeeData } = emp
            await prisma.employee.create({
                data: {
                    ...employeeData,
                    employmentStatus: employeeData.employmentStatus as any,
                    userId: user.id,
                },
            })

            console.log(`  ✅ Created employee: ${emp.employeeId} - ${emp.fullName}`)
            console.log(`     Email: ${emp.email}`)
            console.log(`     Password: ${emp.password}`)
        }

        console.log('\n✨ Employees seeded successfully!')
        console.log('\n📝 Login credentials for testing:')
        console.log('   Use Employee ID as username and password')
        console.log('   Example:')
        console.log('   - Username: EMP-001')
        console.log('   - Password: password123')
        console.log('\n   Or use email:')
        console.log('   - Email: ahmad.hidayat@netmanager.com')
        console.log('   - Password: password123')

    } catch (error) {
        console.error('\n❌ Error seeding employees:', error)
        throw error
    }
}

seedEmployees()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
