import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Migrasi stok ke stokBaru dimulai...')

    // Find records that need migration
    const records = await prisma.barangGudang.findMany({
        where: {
            stok: { gt: 0 }
        }
    })

    console.log(`Ditemukan ${records.length} record untuk dimigrasi`)

    for (const record of records) {
        const stockAny = record as any
        // Only migrate if stokBaru is still 0 (not yet migrated)
        if (stockAny.stokBaru === 0 && record.stok > 0) {
            await (prisma.barangGudang.update as any)({
                where: { id: record.id },
                data: {
                    stokBaru: record.stok
                }
            })
            console.log(`Migrated record ${record.id}: stok ${record.stok} -> stokBaru`)
        }
    }

    console.log('Migrasi selesai!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
