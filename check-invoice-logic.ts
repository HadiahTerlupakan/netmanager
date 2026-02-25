import { prisma } from './lib/prisma'

async function checkLogic() {
    const invoiceOtomatisSetting = await prisma.settings.findUnique({
        where: { key: 'GENERAL_INVOICE_OTOMATIS' },
    })

    const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || '5')

    const today = new Date()
    console.log('Today:', today)

    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysBeforeDue)
    console.log('Target Date (+5 days):', targetDate)

    const targetDay = targetDate.getDate()

    console.log('Looking for customers with due day:', targetDay)

    // Find recent test customers
    const recent = await prisma.pelanggan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, nama: true, jatuhTempo: true }
    })

    console.log('Recent customers:')
    recent.forEach(c => {
        const dueDay = c.jatuhTempo.getDate()
        console.log(`- ${c.nama} | Jatuh Tempo: ${c.jatuhTempo.toISOString()} | Due Day: ${dueDay}`)
        if (dueDay !== targetDay) {
            console.log(`  >>> MISSED INVOICE! (${dueDay} !== ${targetDay})`)
        } else {
            console.log(`  >>> INVOICE GENERATED! (${dueDay} === ${targetDay})`)
        }
    })
}

checkLogic().catch(console.error).finally(() => prisma.$disconnect())
