import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * This script syncs the condition-based stock columns (stokBaru, stokBekas, stokRusak)
 * by recalculating them from the BarangMasuk records for each BarangGudang.
 */
async function main() {
    console.log('Syncing condition-based stock from BarangMasuk records...')

    // Get all BarangGudang records
    const barangGudangs = await prisma.barangGudang.findMany()

    for (const bg of barangGudangs) {
        // Calculate stock from BarangMasuk for this barang+gudang combination
        const masukRecords = await prisma.barangMasuk.findMany({
            where: {
                barangId: bg.barangId,
                gudangId: bg.gudangId
            }
        })

        // Calculate stock from BarangKeluar for this barang+gudang combination
        const keluarRecords = await prisma.barangKeluar.findMany({
            where: {
                barangId: bg.barangId,
                gudangId: bg.gudangId
            }
        })

        let stokBaru = 0
        let stokBekas = 0
        let stokRusak = 0

        // Add from BarangMasuk
        for (const masuk of masukRecords) {
            if (masuk.kondisi === 'BARU') stokBaru += masuk.jumlah
            else if (masuk.kondisi === 'BEKAS') stokBekas += masuk.jumlah
            else if (masuk.kondisi === 'RUSAK') stokRusak += masuk.jumlah
            else stokBaru += masuk.jumlah // Default to BARU
        }

        // Subtract from BarangKeluar
        for (const keluar of keluarRecords) {
            if (keluar.kondisi === 'BARU') stokBaru -= keluar.jumlah
            else if (keluar.kondisi === 'BEKAS') stokBekas -= keluar.jumlah
            else if (keluar.kondisi === 'RUSAK') stokRusak -= keluar.jumlah
            else stokBaru -= keluar.jumlah // Default to BARU
        }

        // Ensure non-negative
        stokBaru = Math.max(0, stokBaru)
        stokBekas = Math.max(0, stokBekas)
        stokRusak = Math.max(0, stokRusak)

        const totalStock = stokBaru + stokBekas + stokRusak

        console.log(`Barang ${bg.barangId} @ Gudang ${bg.gudangId}:`)
        console.log(`  stokBaru: ${stokBaru}, stokBekas: ${stokBekas}, stokRusak: ${stokRusak}, total: ${totalStock}`)

        // Update the record
        await (prisma.barangGudang.update as any)({
            where: { id: bg.id },
            data: {
                stok: totalStock,
                stokBaru,
                stokBekas,
                stokRusak
            }
        })
    }

    console.log('Sync complete!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
