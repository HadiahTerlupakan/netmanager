import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/database'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/inventory/opname/report
 * Get stock report per warehouse showing current stock status,
 * breakdown by condition (BARU/BEKAS/RUSAK), and lost items (isHilang)
 */
export async function GET(req: NextRequest) {
    const startTime = Date.now()

    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const gudangId = searchParams.get('gudangId')

        const dbStart = Date.now()

        // Get all active gudangs with their barang stock
        const gudangs = await prisma.gudang.findMany({
            where: {
                isActive: true,
                ...(gudangId && { id: gudangId })
            },
            include: {
                barangGudang: {
                    include: {
                        barang: {
                            select: {
                                id: true,
                                kode: true,
                                nama: true,
                                satuan: true
                            }
                        }
                    }
                }
            },
            orderBy: { nama: 'asc' }
        })

        // For each gudang and barang, calculate condition breakdown and lost items
        const gudangList = await Promise.all(
            gudangs.map(async (gudang) => {
                const items = await Promise.all(
                    gudang.barangGudang.map(async (bg) => {
                        // Get condition breakdown from transactions
                        const [masukData, keluarData] = await Promise.all([
                            prisma.barangMasuk.findMany({
                                where: { barangId: bg.barangId, gudangId: gudang.id }
                            }),
                            prisma.barangKeluar.findMany({
                                where: { barangId: bg.barangId, gudangId: gudang.id }
                            })
                        ])

                        // Calculate stock by condition
                        let stokBaru = 0
                        let stokBekas = 0
                        let stokRusak = 0

                        masukData.forEach((masuk) => {
                            switch (masuk.kondisi) {
                                case 'BARU': stokBaru += masuk.jumlah; break
                                case 'BEKAS': stokBekas += masuk.jumlah; break
                                case 'RUSAK': stokRusak += masuk.jumlah; break
                                default: stokBaru += masuk.jumlah; break
                            }
                        })

                        keluarData.forEach((keluar) => {
                            switch (keluar.kondisi) {
                                case 'BARU': stokBaru = Math.max(0, stokBaru - keluar.jumlah); break
                                case 'BEKAS': stokBekas = Math.max(0, stokBekas - keluar.jumlah); break
                                case 'RUSAK': stokRusak = Math.max(0, stokRusak - keluar.jumlah); break
                                default: stokBaru = Math.max(0, stokBaru - keluar.jumlah); break
                            }
                        })

                        // Calculate total lost items (where isHilang = true)
                        const totalHilang = keluarData
                            .filter((k) => k.isHilang === true)
                            .reduce((sum, k) => sum + k.jumlah, 0)

                        return {
                            barangId: bg.barangId,
                            barangKode: bg.barang.kode,
                            barangNama: bg.barang.nama,
                            barangSatuan: bg.barang.satuan,
                            stokTotal: bg.stok, // Use BarangGudang.stok as authoritative
                            stokBaru,
                            stokBekas,
                            stokRusak,
                            totalHilang
                        }
                    })
                )

                return {
                    gudangId: gudang.id,
                    gudangKode: gudang.kode,
                    gudangNama: gudang.nama,
                    gudangLokasi: gudang.lokasi,
                    totalBarang: items.length,
                    totalStok: items.reduce((sum, i) => sum + i.stokTotal, 0),
                    totalHilang: items.reduce((sum, i) => sum + i.totalHilang, 0),
                    items
                }
            })
        )

        logger.dbOperation('findMany', 'Gudang+BarangGudang+Transactions', Date.now() - dbStart)

        logger.apiRequest('GET', '/api/inventory/opname/report', 200, Date.now() - startTime, {
            userId: session.user.id,
            gudangCount: gudangList.length
        })

        return NextResponse.json({
            gudangList,
            summary: {
                totalGudang: gudangList.length,
                totalBarang: gudangList.reduce((sum, g) => sum + g.totalBarang, 0),
                totalStok: gudangList.reduce((sum, g) => sum + g.totalStok, 0),
                totalHilang: gudangList.reduce((sum, g) => sum + g.totalHilang, 0)
            }
        })

    } catch (error) {
        console.error('Error generating stock report:', error)
        logger.error('Error generating stock report', error as Error)
        return NextResponse.json(
            { error: 'Gagal menghasilkan laporan stok' },
            { status: 500 }
        )
    }
}
