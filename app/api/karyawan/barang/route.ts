import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get barang list for karyawan (with stock from a gudang)
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const gudangId = searchParams.get('gudangId')

        if (!gudangId) {
            return NextResponse.json({ error: 'gudangId required' }, { status: 400 })
        }

        // Get barang with stock in the specified gudang using BarangGudang
        const barangGudangs = await prisma.barangGudang.findMany({
            where: {
                gudangId,
                stok: { gt: 0 }
            },
            include: {
                barang: {
                    select: {
                        id: true,
                        kode: true,
                        nama: true,
                        satuan: true
                    }
                }
            },
            orderBy: {
                barang: { nama: 'asc' }
            }
        })

        const barangList = barangGudangs.map(bg => ({
            id: bg.barang.id,
            kode: bg.barang.kode,
            nama: bg.barang.nama,
            satuan: bg.barang.satuan,
            stok: bg.stok
        }))

        return NextResponse.json({ barangList })
    } catch (error) {
        console.error('Error fetching barangs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
