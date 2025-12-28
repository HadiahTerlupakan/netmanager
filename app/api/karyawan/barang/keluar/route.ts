import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getInventoryRepository } from '@/lib/repositories'
import { checkSiteRestriction } from '@/lib/site-restriction'

// POST - Create barang keluar
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { barangId, gudangId, jumlah, kondisi, keterangan, tujuanPenggunaan, fotoBukti } = body

        if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
        }

        // Check stock
        const barangGudang = await prisma.barangGudang.findUnique({
            where: {
                barangId_gudangId: { barangId, gudangId }
            }
        })

        if (!barangGudang || barangGudang.stok < jumlah) {
            return NextResponse.json({ error: 'Stok tidak mencukupi' }, { status: 400 })
        }

        // Site restriction check using centralized helper
        const { isRestricted, siteId: userSiteId } = checkSiteRestriction(session, 'k_barang')

        if (isRestricted) {
            if (!userSiteId) {
                return NextResponse.json({ error: 'Access denied: No site assigned' }, { status: 403 })
            }

            // Verify the target gudang belongs to user's site (many-to-many relation)
            const targetGudang = await prisma.gudang.findUnique({
                where: { id: gudangId },
                include: { sites: { select: { id: true } } }
            })

            if (!targetGudang) {
                return NextResponse.json({ error: 'Gudang not found' }, { status: 404 })
            }

            // Check if user's site is in the gudang's sites list
            const gudangSiteIds = targetGudang.sites.map(s => s.id)
            if (!gudangSiteIds.includes(userSiteId)) {
                return NextResponse.json({ error: 'Access denied: Gudang outside your site' }, { status: 403 })
            }
        }

        // Use Repository for consistency
        const inventoryRepository = getInventoryRepository()

        const result = await inventoryRepository.removeStock({
            barangId,
            gudangId,
            jumlah,
            kondisi: kondisi || 'BARU',
            keterangan,
            tujuanPenggunaan,
            fotoBukti: fotoBukti || [],
            userId: session.user.id,
            tanggal: new Date()
        })

        return NextResponse.json({ success: true, barangKeluar: result })
    } catch (error) {
        console.error('Error creating barang keluar:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
