/**
 * Comprehensive Seed Script for NetManager
 * 
 * This script seeds all necessary data for testing and development:
 * - Users & Authentication
 * - Network Infrastructure (OLT, MikroTik, Bandwidth, Packages)
 * - Customers & Invoices
 * - HRIS (Departments, Positions, Employees, Attendance, Payroll)
 * - Helpdesk (Ticket Categories, Tickets)
 * - Work Orders
 * - Finance (Income, Expenses, Tax Records)
 * 
 * Usage: npx tsx scripts/seed-all.ts
 */

import { PrismaClient, Status, TipePelanggan, TagihanStatus, TipePengeluaran, EmploymentStatus, AttendanceStatus, LeaveType, LeaveStatus, SalaryComponentType, PayrollStatus, TicketStatus, TicketPriority, WorkOrderStatus, WorkOrderPriority, WorkOrderType, TaskStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Helper function to generate random dates
function randomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// Helper function to add months to a date
function addMonths(date: Date, months: number) {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
}

async function main() {
    console.log('🌱 Starting comprehensive database seed...\n')

    // ============================================
    // 1. USERS & AUTHENTICATION
    // ============================================
    console.log('👥 Seeding Users...')

    const passwordHash = await hash('password123', 10)

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@netmanager.com' },
        update: { passwordHash },
        create: {
            email: 'admin@netmanager.com',
            name: 'Admin NetManager',
            passwordHash,
        },
    })

    const financeUser = await prisma.user.upsert({
        where: { email: 'finance@netmanager.com' },
        update: { passwordHash },
        create: {
            email: 'finance@netmanager.com',
            name: 'Finance Manager',
            passwordHash,
        },
    })

    const hrUser = await prisma.user.upsert({
        where: { email: 'hr@netmanager.com' },
        update: { passwordHash },
        create: {
            email: 'hr@netmanager.com',
            name: 'HR Manager',
            passwordHash,
        },
    })

    console.log(`✓ Created 3 users (roles will be assigned via CustomRole)\n`)

    // ============================================
    // 2. NETWORK INFRASTRUCTURE
    // ============================================
    console.log('🌐 Seeding Network Infrastructure...')

    // Create OLT
    const olt = await prisma.olt.upsert({
        where: { ipAddress: '192.168.1.1' },
        update: {},
        create: {
            name: 'OLT-MAIN-01',
            ipAddress: '192.168.1.1',
            type: 'ZTE-C300',
            version: 'V2.1.0',
            temperature: 45,
            connectedDevices: 150,
            model: 'C300',
            uptime: '30 days 5 hours',
            syncStatus: '100',
            telnetConnected: true,
            snmpConnected: true,
            telnetPassword: 'zte123',
            snmpCommunityWrite: 'public',
        },
    })

    // Create MikroTik Router
    const mikrotik = await prisma.mikroTikRouter.upsert({
        where: { ipAddress: '192.168.1.2' },
        update: {},
        create: {
            name: 'MikroTik-PPPoE-01',
            ipAddress: '192.168.1.2',
            timezone: '+07:00 Asia/Jakarta',
            apiPort: 8728,
            apiUsername: 'admin',
            apiPassword: 'mikrotik123',
            authPort: 7265,
            accountingPort: 7266,
            secretRadius: 'radius123',
            description: 'Main PPPoE Server',
            pingStatus: 'online',
            userOnline: 85,
        },
    })

    // Create Bandwidth Profiles
    const bandwidth10M = await prisma.bandwidth.upsert({
        where: { name: '10 Mbps' },
        update: {},
        create: {
            name: '10 Mbps',
            maxLimitDownload: '10M',
            maxLimitUpload: '10M',
            burstLimitDownload: '15M',
            burstLimitUpload: '15M',
            priority: 8,
            status: Status.AKTIF,
        },
    })

    const bandwidth20M = await prisma.bandwidth.upsert({
        where: { name: '20 Mbps' },
        update: {},
        create: {
            name: '20 Mbps',
            maxLimitDownload: '20M',
            maxLimitUpload: '20M',
            burstLimitDownload: '30M',
            burstLimitUpload: '30M',
            priority: 6,
            status: Status.AKTIF,
        },
    })

    const bandwidth50M = await prisma.bandwidth.upsert({
        where: { name: '50 Mbps' },
        update: {},
        create: {
            name: '50 Mbps',
            maxLimitDownload: '50M',
            maxLimitUpload: '50M',
            burstLimitDownload: '75M',
            burstLimitUpload: '75M',
            priority: 4,
            status: Status.AKTIF,
        },
    })

    // Create PPP Profiles
    const profile10M = await prisma.profilePPP.upsert({
        where: { name: 'Profile-10M' },
        update: {},
        create: {
            name: 'Profile-10M',
            localAddress: '10.10.10.1',
            remoteAddress: 'pool-10m',
            dnsServer: '8.8.8.8,8.8.4.4',
            sessionTimeout: 0,
            mikroTikRouterId: mikrotik.id,
            status: Status.AKTIF,
        },
    })

    const profile20M = await prisma.profilePPP.upsert({
        where: { name: 'Profile-20M' },
        update: {},
        create: {
            name: 'Profile-20M',
            localAddress: '10.10.10.1',
            remoteAddress: 'pool-20m',
            dnsServer: '8.8.8.8,8.8.4.4',
            sessionTimeout: 0,
            mikroTikRouterId: mikrotik.id,
            status: Status.AKTIF,
        },
    })

    const profile50M = await prisma.profilePPP.upsert({
        where: { name: 'Profile-50M' },
        update: {},
        create: {
            name: 'Profile-50M',
            localAddress: '10.10.10.1',
            remoteAddress: 'pool-50m',
            dnsServer: '8.8.8.8,8.8.4.4',
            sessionTimeout: 0,
            mikroTikRouterId: mikrotik.id,
            status: Status.AKTIF,
        },
    })

    // Create Packages (HargaPaket)
    const paket10M = await prisma.hargaPaket.upsert({
        where: { name: 'Paket Home 10 Mbps' },
        update: {},
        create: {
            name: 'Paket Home 10 Mbps',
            bandwidthId: bandwidth10M.id,
            profilePPPId: profile10M.id,
            harga: 200000,
            durasi: 30,
            usePPN: true,
            ppnPercentage: 11,
            status: Status.AKTIF,
            featured: false,
            description: 'Paket internet untuk rumahan 10 Mbps',
        },
    })

    const paket20M = await prisma.hargaPaket.upsert({
        where: { name: 'Paket Home 20 Mbps' },
        update: {},
        create: {
            name: 'Paket Home 20 Mbps',
            bandwidthId: bandwidth20M.id,
            profilePPPId: profile20M.id,
            harga: 300000,
            durasi: 30,
            usePPN: true,
            ppnPercentage: 11,
            status: Status.AKTIF,
            featured: true,
            description: 'Paket internet untuk rumahan 20 Mbps',
        },
    })

    const paket50M = await prisma.hargaPaket.upsert({
        where: { name: 'Paket Premium 50 Mbps' },
        update: {},
        create: {
            name: 'Paket Premium 50 Mbps',
            bandwidthId: bandwidth50M.id,
            profilePPPId: profile50M.id,
            harga: 500000,
            durasi: 30,
            usePPN: true,
            ppnPercentage: 11,
            status: Status.AKTIF,
            featured: true,
            description: 'Paket internet premium untuk kebutuhan tinggi',
        },
    })

    console.log(`✓ Created network infrastructure\n`)

    // ============================================
    // 3. HRIS - DEPARTMENTS & POSITIONS
    // ============================================
    console.log('🏢 Seeding HRIS Data...')

    const deptIT = await prisma.department.upsert({
        where: { name: 'IT' },
        update: {},
        create: {
            name: 'IT',
            description: 'Information Technology Department',
            jobDescription: 'Mengelola infrastruktur IT dan pengembangan sistem',
            allowedFeatures: JSON.stringify(['ADMIN', 'HRIS', 'NETWORK']),
        },
    })

    const deptTechnical = await prisma.department.upsert({
        where: { name: 'Technical' },
        update: {},
        create: {
            name: 'Technical',
            description: 'Technical Support Department',
            jobDescription: 'Menangani instalasi dan troubleshooting pelanggan',
            allowedFeatures: JSON.stringify(['HELPDESK', 'WORKORDER', 'PELANGGAN']),
        },
    })

    const deptFinance = await prisma.department.upsert({
        where: { name: 'Finance' },
        update: {},
        create: {
            name: 'Finance',
            description: 'Finance Department',
            jobDescription: 'Mengelola keuangan dan akuntansi perusahaan',
            allowedFeatures: JSON.stringify(['FINANCE', 'BILLING', 'PELANGGAN']),
        },
    })

    const deptHR = await prisma.department.upsert({
        where: { name: 'HR' },
        update: {},
        create: {
            name: 'HR',
            description: 'Human Resources Department',
            jobDescription: 'Mengelola SDM dan payroll',
            allowedFeatures: JSON.stringify(['HRIS']),
        },
    })

    const deptCustomerService = await prisma.department.upsert({
        where: { name: 'Customer Service' },
        update: {},
        create: {
            name: 'Customer Service',
            description: 'Customer Service Department',
            jobDescription: 'Menangani keluhan dan pertanyaan pelanggan',
            allowedFeatures: JSON.stringify(['HELPDESK', 'PELANGGAN']),
        },
    })

    // Create Positions
    const posManager = await prisma.position.upsert({
        where: { title: 'Manager' },
        update: {},
        create: {
            title: 'Manager',
            code: 'MGR-001',
            level: 'Manager',
            description: 'Department Manager',
            isActive: true,
        },
    })

    const posTechnician = await prisma.position.upsert({
        where: { title: 'Field Technician' },
        update: {},
        create: {
            title: 'Field Technician',
            code: 'TECH-001',
            level: 'Junior',
            description: 'Field Technician',
            departmentId: deptTechnical.id,
            isActive: true,
        },
    })

    const posCS = await prisma.position.upsert({
        where: { title: 'Customer Service Representative' },
        update: {},
        create: {
            title: 'Customer Service Representative',
            code: 'CS-001',
            level: 'Junior',
            description: 'Customer Service',
            departmentId: deptCustomerService.id,
            isActive: true,
        },
    })

    const posFinanceStaff = await prisma.position.upsert({
        where: { title: 'Finance Staff' },
        update: {},
        create: {
            title: 'Finance Staff',
            code: 'FIN-001',
            level: 'Junior',
            description: 'Finance Staff',
            departmentId: deptFinance.id,
            isActive: true,
        },
    })

    // Create Employees
    const employees = []

    const emp1 = await prisma.employee.upsert({
        where: { employeeId: 'EMP-001' },
        update: {},
        create: {
            employeeId: 'EMP-001',
            fullName: 'Budi Santoso',
            email: 'budi@netmanager.com',
            phone: '081234567801',
            dateOfBirth: new Date('1990-05-15'),
            gender: 'MALE',
            idCardNumber: '3201011505900001',
            address: 'Jl. Merdeka No. 1',
            city: 'Jakarta',
            province: 'DKI Jakarta',
            departmentId: deptTechnical.id,
            positionId: posTechnician.id,
            employmentStatus: EmploymentStatus.PERMANENT,
            joinDate: new Date('2020-01-15'),
            bankName: 'BCA',
            bankAccountNumber: '1234567890',
            bankAccountName: 'Budi Santoso',
            isActive: true,
        },
    })
    employees.push(emp1)

    const emp2 = await prisma.employee.upsert({
        where: { employeeId: 'EMP-002' },
        update: {},
        create: {
            employeeId: 'EMP-002',
            fullName: 'Siti Nurhaliza',
            email: 'siti@netmanager.com',
            phone: '081234567802',
            dateOfBirth: new Date('1992-08-20'),
            gender: 'FEMALE',
            idCardNumber: '3201012008920002',
            address: 'Jl. Sudirman No. 2',
            city: 'Jakarta',
            province: 'DKI Jakarta',
            departmentId: deptCustomerService.id,
            positionId: posCS.id,
            employmentStatus: EmploymentStatus.PERMANENT,
            joinDate: new Date('2020-03-01'),
            bankName: 'Mandiri',
            bankAccountNumber: '0987654321',
            bankAccountName: 'Siti Nurhaliza',
            isActive: true,
        },
    })
    employees.push(emp2)

    const emp3 = await prisma.employee.upsert({
        where: { employeeId: 'EMP-003' },
        update: {},
        create: {
            employeeId: 'EMP-003',
            fullName: 'Andi Wijaya',
            email: 'andi@netmanager.com',
            phone: '081234567803',
            dateOfBirth: new Date('1988-03-10'),
            gender: 'MALE',
            idCardNumber: '3201011003880003',
            address: 'Jl. Gatot Subroto No. 3',
            city: 'Jakarta',
            province: 'DKI Jakarta',
            departmentId: deptFinance.id,
            positionId: posFinanceStaff.id,
            employmentStatus: EmploymentStatus.PERMANENT,
            joinDate: new Date('2019-06-01'),
            bankName: 'BRI',
            bankAccountNumber: '1122334455',
            bankAccountName: 'Andi Wijaya',
            isActive: true,
        },
    })
    employees.push(emp3)

    console.log(`✓ Created ${employees.length} employees\n`)

    // Create Salary Components
    const salaryBasic = await prisma.salaryComponent.upsert({
        where: { code: 'BASIC' },
        update: {},
        create: {
            code: 'BASIC',
            name: 'Gaji Pokok',
            type: SalaryComponentType.BASIC_SALARY,
            isTaxable: true,
            isActive: true,
        },
    })

    const salaryTransport = await prisma.salaryComponent.upsert({
        where: { code: 'TRANSPORT' },
        update: {},
        create: {
            code: 'TRANSPORT',
            name: 'Tunjangan Transport',
            type: SalaryComponentType.ALLOWANCE,
            isTaxable: true,
            isActive: true,
        },
    })

    const salaryMeal = await prisma.salaryComponent.upsert({
        where: { code: 'MEAL' },
        update: {},
        create: {
            code: 'MEAL',
            name: 'Tunjangan Makan',
            type: SalaryComponentType.ALLOWANCE,
            isTaxable: true,
            isActive: true,
        },
    })

    // Assign salaries to employees
    for (const emp of employees) {
        // Check if salary already exists
        const existingBasic = await prisma.employeeSalary.findFirst({
            where: {
                employeeId: emp.id,
                salaryComponentId: salaryBasic.id,
            },
        })

        if (!existingBasic) {
            await prisma.employeeSalary.create({
                data: {
                    employeeId: emp.id,
                    salaryComponentId: salaryBasic.id,
                    amount: BigInt(5000000), // 5 juta
                    effectiveDate: emp.joinDate,
                },
            })
        }

        const existingTransport = await prisma.employeeSalary.findFirst({
            where: {
                employeeId: emp.id,
                salaryComponentId: salaryTransport.id,
            },
        })

        if (!existingTransport) {
            await prisma.employeeSalary.create({
                data: {
                    employeeId: emp.id,
                    salaryComponentId: salaryTransport.id,
                    amount: BigInt(500000), // 500rb
                    effectiveDate: emp.joinDate,
                },
            })
        }
    }

    // ============================================
    // 4. CUSTOMERS (PELANGGAN)
    // ============================================
    console.log('👨‍👩‍👧‍👦 Seeding Customers...')

    const customers = []
    const currentDate = new Date()

    for (let i = 1; i <= 20; i++) {
        const idPelanggan = `${10000000 + i}`
        const tanggalAktif = randomDate(new Date(2024, 0, 1), currentDate)
        const jatuhTempo = addMonths(tanggalAktif, 1)

        const paket = i <= 7 ? paket10M : i <= 15 ? paket20M : paket50M

        const customer = await prisma.pelanggan.upsert({
            where: { idPelanggan },
            update: {},
            create: {
                idPelanggan,
                nama: `Pelanggan ${i}`,
                username: `user${i}`,
                password: `pass${i}`,
                passwordLogin: await hash('pelanggan123', 10),
                hargaPaketId: paket.id,
                tipe: TipePelanggan.REGULER,
                tanggalAktif,
                jatuhTempo,
                status: i <= 18 ? Status.AKTIF : Status.NONAKTIF,
                alamat: `Jl. Pelanggan ${i} No. ${i}`,
                provinsi: 'Jawa Barat',
                kabupatenKota: 'Bandung',
                kelurahanDesa: 'Sukajadi',
                kecamatan: 'Sukajadi',
                noTelp: `0812345678${10 + i}`,
                email: `pelanggan${i}@example.com`,
                usePPN: true,
                useDiscount: false,
                useProrate: false,
            },
        })
        customers.push(customer)
    }

    console.log(`✓ Created ${customers.length} customers\n`)

    // ============================================
    // 5. INVOICES (TAGIHAN)
    // ============================================
    console.log('💰 Seeding Invoices...')

    let invoiceCount = 0
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()

    // Create invoices for the last 3 months
    for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
        const invoiceMonth = currentMonth - monthOffset <= 0
            ? 12 + (currentMonth - monthOffset)
            : currentMonth - monthOffset
        const invoiceYear = currentMonth - monthOffset <= 0
            ? currentYear - 1
            : currentYear

        for (const customer of customers.slice(0, 18)) { // Only active customers
            const paket = await prisma.hargaPaket.findUnique({
                where: { id: customer.hargaPaketId },
            })

            if (!paket) continue

            const subtotal = paket.harga
            const ppn = Math.round(subtotal * 0.11)
            const total = subtotal + ppn

            const noTagihan = `TAG-${invoiceYear}${String(invoiceMonth).padStart(2, '0')}-${String(invoiceCount + 1).padStart(4, '0')}`

            const jatuhTempo = new Date(invoiceYear, invoiceMonth - 1, 10)
            const isPaid = monthOffset > 0 || Math.random() > 0.3 // Older invoices more likely to be paid

            await prisma.tagihan.upsert({
                where: {
                    pelangganId_periodeBulan_periodeTahun: {
                        pelangganId: customer.id,
                        periodeBulan: invoiceMonth,
                        periodeTahun: invoiceYear,
                    }
                },
                update: {},
                create: {
                    pelangganId: customer.id,
                    noTagihan,
                    periodeBulan: invoiceMonth,
                    periodeTahun: invoiceYear,
                    subtotal,
                    ppn,
                    total,
                    status: isPaid ? TagihanStatus.LUNAS : TagihanStatus.BELUM_LUNAS,
                    jatuhTempo,
                    tanggalBayar: isPaid ? randomDate(jatuhTempo, new Date()) : null,
                    metodePembayaran: isPaid ? 'TRANSFER' : null,
                },
            })
            invoiceCount++
        }
    }

    console.log(`✓ Created ${invoiceCount} invoices\n`)

    // ============================================
    // 6. HELPDESK - TICKET CATEGORIES
    // ============================================
    console.log('🎫 Seeding Helpdesk Data...')

    const catKoneksi = await prisma.ticketCategory.upsert({
        where: { name: 'Koneksi Terputus' },
        update: {},
        create: {
            name: 'Koneksi Terputus',
            description: 'Masalah koneksi internet terputus',
            color: '#ef4444',
            displayOrder: 1,
            isActive: true,
        },
    })

    const catBilling = await prisma.ticketCategory.upsert({
        where: { name: 'Billing' },
        update: {},
        create: {
            name: 'Billing',
            description: 'Pertanyaan tentang tagihan',
            color: '#3b82f6',
            displayOrder: 2,
            isActive: true,
        },
    })

    const catUpgrade = await prisma.ticketCategory.upsert({
        where: { name: 'Permintaan Upgrade' },
        update: {},
        create: {
            name: 'Permintaan Upgrade',
            description: 'Permintaan upgrade kecepatan',
            color: '#10b981',
            displayOrder: 3,
            isActive: true,
        },
    })

    const catLainnya = await prisma.ticketCategory.upsert({
        where: { name: 'Lainnya' },
        update: {},
        create: {
            name: 'Lainnya',
            description: 'Masalah lainnya',
            color: '#6b7280',
            displayOrder: 4,
            isActive: true,
        },
    })

    // Create Tickets
    let ticketCount = 0
    for (let i = 0; i < 15; i++) {
        const customer = customers[i % customers.length]
        const categories = [catKoneksi, catBilling, catUpgrade, catLainnya]
        const category = categories[i % categories.length]
        const createdAt = randomDate(new Date(2024, 10, 1), currentDate)

        const ticketNumber = `TIK-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, '0')}${String(createdAt.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`

        const statuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED]
        const priorities = [TicketPriority.LOW, TicketPriority.NORMAL, TicketPriority.HIGH, TicketPriority.URGENT]

        const status = statuses[i % statuses.length]
        const priority = priorities[i % priorities.length]

        await prisma.ticket.create({
            data: {
                ticketNumber,
                pelangganId: customer.id,
                categoryId: category.id,
                subject: `${category.name} - Pelanggan ${customer.nama}`,
                description: `Deskripsi masalah ${category.name} dari pelanggan ${customer.nama}`,
                status,
                priority,
                assignedToId: i % 2 === 0 ? adminUser.id : null,
                assignedAt: i % 2 === 0 ? createdAt : null,
                createdAt,
                lastActivityAt: createdAt,
                resolvedAt: status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED ? randomDate(createdAt, currentDate) : null,
                closedAt: status === TicketStatus.CLOSED ? randomDate(createdAt, currentDate) : null,
            },
        })
        ticketCount++
    }

    console.log(`✓ Created ${ticketCount} tickets\n`)

    // ============================================
    // 7. WORK ORDERS
    // ============================================
    console.log('🔧 Seeding Work Orders...')

    let woCount = 0
    for (let i = 0; i < 10; i++) {
        const customer = customers[i % customers.length]
        const createdAt = randomDate(new Date(2024, 10, 1), currentDate)

        const woNumber = `WO-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, '0')}${String(createdAt.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`

        const types = [WorkOrderType.INSTALLATION, WorkOrderType.TROUBLESHOOT, WorkOrderType.MAINTENANCE, WorkOrderType.UPGRADE]
        const type = types[i % types.length]

        const statuses = [WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED]
        const status = statuses[i % statuses.length]

        const priorities = [WorkOrderPriority.LOW, WorkOrderPriority.NORMAL, WorkOrderPriority.HIGH, WorkOrderPriority.URGENT]
        const priority = priorities[i % priorities.length]

        await prisma.workOrder.create({
            data: {
                workOrderNumber: woNumber,
                pelangganId: customer.id,
                type,
                title: `${type} - ${customer.nama}`,
                description: `Pekerjaan ${type} untuk pelanggan ${customer.nama}`,
                status,
                priority,
                departmentId: deptTechnical.id,
                assignedToId: i % 2 === 0 ? emp1.id : null,
                locationAddress: customer.alamat,
                contactName: customer.nama,
                contactPhone: customer.noTelp,
                scheduledDate: addMonths(createdAt, 0),
                createdAt,
            },
        })
        woCount++
    }

    console.log(`✓ Created ${woCount} work orders\n`)

    // ============================================
    // 8. FINANCE - INCOME & EXPENSES
    // ============================================
    console.log('💵 Seeding Finance Data...')

    // Create Expenses (Pengeluaran)
    const expenseCategories = ['OPERASIONAL', 'PEMELIHARAAN', 'GAJI', 'UTILITAS', 'PEMASARAN']

    for (let i = 0; i < 20; i++) {
        const tanggal = randomDate(new Date(2024, 9, 1), currentDate)
        const category = expenseCategories[i % expenseCategories.length]
        const amount = BigInt(Math.floor(Math.random() * 10000000) + 1000000) // 1-10 juta

        await prisma.pengeluaran.create({
            data: {
                tanggal,
                tipePengeluaran: i % 3 === 0 ? TipePengeluaran.CAPEX : TipePengeluaran.OPEX,
                kategori: category,
                deskripsi: `Pengeluaran ${category} #${i + 1}`,
                jumlah: amount,
                metodeBayar: 'TRANSFER',
                isApproved: true,
                approvedBy: adminUser.id,
                approvedAt: tanggal,
                createdBy: financeUser.id,
            },
        })
    }

    // Create Income (Pemasukan) - Manual
    for (let i = 0; i < 10; i++) {
        const tanggal = randomDate(new Date(2024, 9, 1), currentDate)
        const amount = BigInt(Math.floor(Math.random() * 20000000) + 5000000) // 5-25 juta

        await prisma.pemasukan.create({
            data: {
                tanggal,
                kategori: 'PENJUALAN',
                deskripsi: `Pemasukan pembayaran pelanggan batch #${i + 1}`,
                jumlah: amount,
                metodeBayar: 'TRANSFER',
                isVerified: true,
                verifiedBy: financeUser.id,
                verifiedAt: tanggal,
                createdBy: financeUser.id,
            },
        })
    }

    console.log(`✓ Created finance records\n`)

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n✅ Seed completed successfully!\n')
    console.log('='.repeat(50))
    console.log('SUMMARY:')
    console.log('='.repeat(50))
    console.log(`👥 Users: 3 (admin, finance, hr)`)
    console.log(`🌐 Network: OLT, MikroTik, Bandwidths, Profiles, Packages`)
    console.log(`🏢 Departments: 5`)
    console.log(`👔 Positions: 4`)
    console.log(`👨‍💼 Employees: ${employees.length}`)
    console.log(`👨‍👩‍👧‍👦 Customers: ${customers.length}`)
    console.log(`💰 Invoices: ${invoiceCount}`)
    console.log(`🎫 Tickets: ${ticketCount}`)
    console.log(`🔧 Work Orders: ${woCount}`)
    console.log(`💵 Finance: 30 records (20 expenses, 10 income)`)
    console.log('='.repeat(50))
    console.log('\n📝 DEFAULT LOGIN CREDENTIALS:')
    console.log('='.repeat(50))
    console.log('Admin:')
    console.log('  Email: admin@netmanager.com')
    console.log('  Password: password123')
    console.log('\nFinance:')
    console.log('  Email: finance@netmanager.com')
    console.log('  Password: password123')
    console.log('\nHR:')
    console.log('  Email: hr@netmanager.com')
    console.log('  Password: password123')
    console.log('\nCustomer Portal (any customer):')
    console.log('  ID Pelanggan: 10000001 - 10000020')
    console.log('  Password: pelanggan123')
    console.log('='.repeat(50))
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error('\n❌ Seed failed!')
        console.error('Error:', e.message)
        if (e.stack) {
            console.error('\nStack trace:')
            console.error(e.stack)
        }
        await prisma.$disconnect()
        process.exit(1)
    })
