import { prisma } from './lib/prisma'

async function check() {
    const s = await prisma.settings.findUnique({ where: { key: 'GENERAL_INVOICE_OTOMATIS' } })
    console.log('GENERAL_INVOICE_OTOMATIS:', s?.value)
}

check().catch(console.error).finally(() => prisma.$disconnect())
