import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

        // Check for Site-Based Restriction Policy
        const userPermissions = (session.user as any).permissions || []
        const isSiteRestricted = userPermissions.includes('k_barang:site_only')
        const userSiteId = (session.user as any).siteId

        if (isSiteRestricted) {
            if (!userSiteId) {
                return NextResponse.json({ error: 'Access denied: No site assigned' }, { status: 403 })
            }

            // Verify the target gudang belongs to user's site
            const targetGudang = await prisma.gudang.findUnique({
                where: { id: gudangId },
                select: { siteId: true }
            })

            if (!targetGudang) {
                return NextResponse.json({ error: 'Gudang not found' }, { status: 404 })
            }

            if (targetGudang.siteId !== userSiteId) {
                return NextResponse.json({ error: 'Access denied: Gudang outside your site' }, { status: 403 })
            }
        }

        // Create barang keluar and update stock in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create barang keluar
            const keluar = await tx.barangKeluar.create({
                data: {
                    barangId,
                    gudangId,
                    jumlah,
                    kondisi: kondisi || 'BARU',
                    keterangan,
                    tujuanPenggunaan,
                    fotoBukti: fotoBukti || [],
                    userId: session.user.id
                },
                include: { barang: true, gudang: true }
            })

            // Update stock
            await tx.barangGudang.update({
                where: {
                    barangId_gudangId: { barangId, gudangId }
                },
                data: {
                    stok: { decrement: jumlah }
                }
            })

            return keluar
        })

        return NextResponse.json({ success: true, barangKeluar: result })
    } catch (error) {
        console.error('Error creating barang keluar:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
