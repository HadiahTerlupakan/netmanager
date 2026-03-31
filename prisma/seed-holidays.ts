import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
    const holidays = [
        // 2025 Holidays
        { date: '2025-01-01', description: 'Tahun Baru 2025 Masehi', isNational: true },
        { date: '2025-01-27', description: 'Isra Mikraj Nabi Muhammad SAW', isNational: true },
        { date: '2025-01-28', description: 'Cuti Bersama Tahun Baru Imlek', isNational: false },
        { date: '2025-01-29', description: 'Tahun Baru Imlek 2576 Kongzili', isNational: true },
        { date: '2025-03-28', description: 'Cuti Bersama Hari Suci Nyepi', isNational: false },
        { date: '2025-03-29', description: 'Hari Suci Nyepi (Tahun Baru Saka 1947)', isNational: true },
        { date: '2025-03-31', description: 'Hari Raya Idul Fitri 1446 H', isNational: true },
        { date: '2025-04-01', description: 'Hari Raya Idul Fitri 1446 H', isNational: true },
        { date: '2025-04-02', description: 'Cuti Bersama Idul Fitri 1446 H', isNational: false },
        { date: '2025-04-03', description: 'Cuti Bersama Idul Fitri 1446 H', isNational: false },
        { date: '2025-04-04', description: 'Cuti Bersama Idul Fitri 1446 H', isNational: false },
        { date: '2025-04-07', description: 'Cuti Bersama Idul Fitri 1446 H', isNational: false },
        { date: '2025-04-18', description: 'Wafat Yesus Kristus', isNational: true },
        { date: '2025-04-20', description: 'Kebangkitan Yesus Kristus (Paskah)', isNational: true },
        { date: '2025-05-01', description: 'Hari Buruh Internasional', isNational: true },
        { date: '2025-05-12', description: 'Hari Raya Waisak 2569 BE', isNational: true },
        { date: '2025-05-13', description: 'Cuti Bersama Hari Raya Waisak', isNational: false },
        { date: '2025-05-29', description: 'Kenaikan Yesus Kristus', isNational: true },
        { date: '2025-05-30', description: 'Cuti Bersama Kenaikan Yesus Kristus', isNational: false },
        { date: '2025-06-01', description: 'Hari Lahir Pancasila', isNational: true },
        { date: '2025-06-06', description: 'Hari Raya Idul Adha 1446 H', isNational: true },
        { date: '2025-06-09', description: 'Cuti Bersama Idul Adha 1446 H', isNational: false },
        { date: '2025-06-27', description: 'Tahun Baru Islam 1447 H', isNational: true },
        { date: '2025-08-17', description: 'Hari Kemerdekaan Republik Indonesia', isNational: true },
        { date: '2025-09-05', description: 'Maulid Nabi Muhammad SAW', isNational: true },
        { date: '2025-12-25', description: 'Hari Raya Natal', isNational: true },
        { date: '2025-12-26', description: 'Cuti Bersama Hari Raya Natal', isNational: false },

        // 2026 Holidays
        { date: '2026-01-01', description: 'Tahun Baru 2026 Masehi', isNational: true },
        { date: '2026-01-16', description: 'Isra Mikraj Nabi Muhammad SAW', isNational: true },
        { date: '2026-02-16', description: 'Cuti Bersama Tahun Baru Imlek', isNational: false },
        { date: '2026-02-17', description: 'Tahun Baru Imlek 2577 Kongzili', isNational: true },
        { date: '2026-03-18', description: 'Cuti Bersama Hari Suci Nyepi', isNational: false },
        { date: '2026-03-19', description: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', isNational: true },
        { date: '2026-03-20', description: 'Cuti Bersama Idul Fitri 1447 H', isNational: false },
        { date: '2026-03-21', description: 'Hari Raya Idul Fitri 1447 H', isNational: true },
        { date: '2026-03-22', description: 'Hari Raya Idul Fitri 1447 H', isNational: true },
        { date: '2026-03-23', description: 'Cuti Bersama Idul Fitri 1447 H', isNational: false },
        { date: '2026-03-24', description: 'Cuti Bersama Idul Fitri 1447 H', isNational: false },
        { date: '2026-04-03', description: 'Wafat Yesus Kristus', isNational: true },
        { date: '2026-04-05', description: 'Kebangkitan Yesus Kristus (Paskah)', isNational: true },
        { date: '2026-05-01', description: 'Hari Buruh Internasional', isNational: true },
        { date: '2026-05-14', description: 'Kenaikan Yesus Kristus', isNational: true },
        { date: '2026-05-15', description: 'Cuti Bersama Kenaikan Yesus Kristus', isNational: false },
        { date: '2026-05-27', description: 'Hari Raya Idul Adha 1447 H', isNational: true },
        { date: '2026-05-28', description: 'Cuti Bersama Idul Adha 1447 H', isNational: false },
        { date: '2026-05-31', description: 'Hari Raya Waisak 2570 BE', isNational: true },
        { date: '2026-06-01', description: 'Hari Lahir Pancasila', isNational: true },
        { date: '2026-06-16', description: 'Tahun Baru Islam 1448 H', isNational: true },
        { date: '2026-08-17', description: 'Hari Kemerdekaan Republik Indonesia', isNational: true },
        { date: '2026-08-25', description: 'Maulid Nabi Muhammad SAW', isNational: true },
        { date: '2026-12-24', description: 'Cuti Bersama Hari Raya Natal', isNational: false },
        { date: '2026-12-25', description: 'Hari Raya Natal', isNational: true },
    ]

    console.log('Start seeding holidays...')

    for (const h of holidays) {
        const holidayDate = new Date(h.date)

        // Upsert to populate or update if exists
        // Using findFirst + update/create because unique constraint is [date, tenantId]
        const existing = await prisma.holiday.findFirst({
            where: { date: holidayDate, tenantId: null }
        })

        if (existing) {
            await prisma.holiday.update({
                where: { id: existing.id },
                data: {
                    description: h.description,
                    isNational: h.isNational
                }
            })
        } else {
            await prisma.holiday.create({
                data: {
                    id: randomUUID(),
                    updatedAt: new Date(),
                    date: holidayDate,
                    description: h.description,
                    isNational: h.isNational,
                    tenantId: null
                }
            })
        }
    }

    console.log('Seeding holidays finished.')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
