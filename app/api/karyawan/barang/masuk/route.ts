import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Create barang masuk
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { barangId, gudangId, jumlah, kondisi, keterangan, supplier, fotoBukti } = body

        if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
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

        // Create barang masuk and update stock in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create barang masuk
            const masuk = await tx.barangMasuk.create({
                data: {
                    barangId,
                    gudangId,
                    jumlah,
                    kondisi: kondisi || 'BARU',
                    keterangan,
                    supplier,
                    fotoBukti: fotoBukti || [],
                    userId: session.user.id
                },
                include: { barang: true, gudang: true }
            })

            // Update or create stock
            await tx.barangGudang.upsert({
                where: {
                    barangId_gudangId: { barangId, gudangId }
                },
                create: {
                    barangId,
                    gudangId,
                    stok: jumlah
                },
                update: {
                    stok: { increment: jumlah }
                }
            })

            return masuk
        })

        return NextResponse.json({ success: true, barangMasuk: result })
    } catch (error) {
        console.error('Error creating barang masuk:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
