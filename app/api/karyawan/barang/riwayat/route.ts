import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get transaction history for current user
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check for Site-Based Restriction Policy
        const user = session.user as any
        const userId = user.id
        const userPermissions = (user.permissions as string[]) || []
        const isSiteRestricted = userPermissions.includes('k_barang:site_only')

        let whereClauseMasuk: any = { userId }
        let whereClauseKeluar: any = { userId }

        if (isSiteRestricted) {
            if (!user.siteId) {
                return NextResponse.json({ transactions: [] })
            }
            // Filter transactions where the specific Gudang belongs to the user's Site
            whereClauseMasuk.gudang = { siteId: user.siteId }
            whereClauseKeluar.gudang = { siteId: user.siteId }
        }

        // Get barang masuk
        const barangMasuk = await prisma.barangMasuk.findMany({
            where: whereClauseMasuk,
            include: {
                barang: { select: { kode: true, nama: true, satuan: true } },
                gudang: { select: { nama: true } }
            },
            orderBy: { tanggal: 'desc' },
            take: 50
        })

        // Get barang keluar
        const barangKeluar = await prisma.barangKeluar.findMany({
            where: whereClauseKeluar,
            include: {
                barang: { select: { kode: true, nama: true, satuan: true } },
                gudang: { select: { nama: true } }
            },
            orderBy: { tanggal: 'desc' },
            take: 50
        })

        // Combine and sort
        const transactions = [
            ...barangMasuk.map(m => ({
                id: m.id,
                type: 'masuk' as const,
                barang: m.barang,
                gudang: m.gudang,
                jumlah: m.jumlah,
                kondisi: m.kondisi,
                keterangan: m.keterangan,
                tanggal: m.tanggal.toISOString()
            })),
            ...barangKeluar.map(k => ({
                id: k.id,
                type: 'keluar' as const,
                barang: k.barang,
                gudang: k.gudang,
                jumlah: k.jumlah,
                kondisi: k.kondisi,
                keterangan: k.keterangan,
                tanggal: k.tanggal.toISOString()
            }))
        ].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())

        return NextResponse.json({ transactions })
    } catch (error) {
        console.error('Error fetching transaction history:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
