import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get gudang list for karyawan
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check for Site-Based Restriction Policy
        const user = session.user as any
        const userPermissions = (user.permissions as string[]) || []
        const isSiteRestricted = userPermissions.includes('k_barang:site_only')

        let whereClause: any = { isActive: true }

        if (isSiteRestricted) {
            if (!user.siteId) {
                // If restricted but no site assigned, return 403 as requested
                return NextResponse.json({ error: 'Access denied: No site assigned' }, { status: 403 })
            }
            // Filter by Site
            whereClause.siteId = user.siteId
        }

        const gudangs = await prisma.gudang.findMany({
            where: whereClause,
            select: {
                id: true,
                kode: true,
                nama: true,
                lokasi: true
            },
            orderBy: { nama: 'asc' }
        })

        return NextResponse.json({ gudangList: gudangs })
    } catch (error) {
        console.error('Error fetching gudangs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
