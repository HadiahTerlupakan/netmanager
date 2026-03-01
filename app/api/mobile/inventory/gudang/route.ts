import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { isSuperAdmin } from '@/lib/auth'

// GET - Get gudang list for mobile
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        if (!token) {
            return NextResponse.json({ error: 'Token tidak tersedia' }, { status: 401 })
        }
        const decoded = await verifyMobileToken(token)

        if (!decoded || !decoded.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const userId = decoded.id as string

        // Fetch user to check permissions and site access (Multi-site support)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                role: { include: { permission: true } },
                sites: true,
                userSites: {
                    include: { site: true }
                }
            }
        })

        // If not a User, check if it's a Mitra
        const mitra = !user ? await prismaMitra.mitra.findUnique({
            where: { id: userId },
            select: { id: true, name: true, siteId: true, mitraType: true }
        }) : null

        if (!user && !mitra) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
        }

        const whereClause: Record<string, unknown> = { isActive: true }

        if (mitra) {
            // Mitra: always site-restricted based on their siteId + WO's siteId
            const allowedSiteIds: string[] = []
            if (mitra.siteId) allowedSiteIds.push(mitra.siteId)

            const { searchParams } = new URL(req.url)
            const workOrderId = searchParams.get('workOrderId')
            if (workOrderId) {
                const wo = await prisma.workOrders.findUnique({
                    where: { id: workOrderId },
                    select: { siteId: true }
                })
                if (wo?.siteId && !allowedSiteIds.includes(wo.siteId)) {
                    allowedSiteIds.push(wo.siteId)
                }
            }

            if (allowedSiteIds.length > 0) {
                whereClause.sites = {
                    some: { id: { in: allowedSiteIds } }
                }
            }
        } else if (user) {
            // Check for Site-Based Restriction Policy
            // Mobile users are restricted to their site by default unless SUPER_ADMIN or "Super Admin"
            const isSuper = isSuperAdmin({ role: user.role?.name });
            const isSiteRestricted = !isSuper;

            if (isSiteRestricted) {
                const { searchParams } = new URL(req.url)
                const workOrderId = searchParams.get('workOrderId')

                const allowedSiteIds: string[] = []

                if (user.userSites && user.userSites.length > 0) {
                    allowedSiteIds.push(...user.userSites.map(us => us.siteId));
                } else if (user.sites?.id) {
                    allowedSiteIds.push(user.sites.id)
                }

                if (workOrderId) {
                    const wo = await prisma.workOrders.findUnique({
                        where: { id: workOrderId },
                        select: { siteId: true }
                    })
                    if (wo?.siteId && !allowedSiteIds.includes(wo.siteId)) {
                        allowedSiteIds.push(wo.siteId)
                    }
                }

                if (allowedSiteIds.length === 0) {
                    return NextResponse.json({
                        error: `Halo ${user.name}, akun Anda belum memiliki Site yang ditentukan. Silakan hubungi admin untuk assign Site ke akun Anda agar dapat melihat daftar Gudang.`,
                        code: 'NO_SITE_ASSIGNED',
                        debug: {
                            userId: user.id,
                            role: user.role?.name
                        }
                    }, { status: 403 })
                }

                whereClause.sites = {
                    some: { id: { in: allowedSiteIds } }
                }
            }
        }

        // console.log('[Mobile Gudang] User:', user.name, 'Role:', user.role?.name);
        // console.log('[Mobile Gudang] isSiteRestricted:', isSiteRestricted);
        // console.log('[Mobile Gudang] WhereClause:', JSON.stringify(whereClause, null, 2));

        const gudangs = await prisma.gudang.findMany({
            where: whereClause,
            select: {
                id: true,
                kode: true,
                nama: true,
                lokasi: true,
                sites: { select: { id: true, name: true } } // Debug: see attached sites
            },
            orderBy: { nama: 'asc' }
        })

        // console.log('[Mobile Gudang] Found:', gudangs.length, 'warehouses');
        gudangs.forEach(g => console.log(`- ${g.nama} (Sites: ${g.sites.map(s => s.name).join(', ') || 'NONE'})`));

        return NextResponse.json({ gudangList: gudangs })
    } catch (error) {
        console.error('Error fetching gudangs (mobile):', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
