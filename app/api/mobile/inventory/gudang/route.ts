import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'

// GET - Get gudang list for mobile
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = await verifyMobileToken(token)

        if (!decoded || !decoded.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const userId = decoded.id as string

        // Fetch user to check permissions and siteId
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                role: { include: { permission: true } },
                sites: true
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Check for Site-Based Restriction Policy
        // Mobile users might not have full permissions object like session, so we check role permissions
        const userPermissions = user.role?.permission.map(p => `${p.resource}:${p.action}`) || []
        const isSuperAdmin = user.role?.name === 'SUPER_ADMIN'
        const isSiteRestricted = !isSuperAdmin && userPermissions.includes('k_barang:site_only')

        let whereClause: any = { isActive: true }

        if (isSiteRestricted) {
            const { searchParams } = new URL(req.url)
            const workOrderId = searchParams.get('workOrderId')

            const allowedSiteIds = []
            if (user.sites?.id) allowedSiteIds.push(user.sites.id)

            if (workOrderId) {
                const wo = await prisma.workOrders.findUnique({
                    where: { id: workOrderId },
                    select: { siteId: true }
                })
                if (wo?.siteId) allowedSiteIds.push(wo.siteId)
            }

            if (allowedSiteIds.length === 0) {
                return NextResponse.json({ 
                    error: 'Anda belum memiliki site yang ditentukan. Silakan hubungi admin untuk assign site ke akun Anda.',
                    code: 'NO_SITE_ASSIGNED'
                }, { status: 403 })
            }

            // Filter by Site (User's site OR WorkOrder's site) using many-to-many relation
            whereClause.sites = {
                some: {
                    id: { in: allowedSiteIds }
                }
            }
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
        console.error('Error fetching gudangs (mobile):', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
