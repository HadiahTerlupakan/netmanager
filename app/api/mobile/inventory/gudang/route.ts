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
        if (!token) {
            return NextResponse.json({ error: 'Token not provided' }, { status: 401 })
        }
        const decoded = await verifyMobileToken(token)

        if (!decoded || !decoded.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
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

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Check for Site-Based Restriction Policy
        // Mobile users are restricted to their site by default unless SUPER_ADMIN or "Super Admin"
        // This fixes the issue where users see Gudang outside their site
        const roleName = (user.role?.name || '').trim().toUpperCase().replace(/\s+/g, '_');
        const isSuperAdmin = roleName === 'SUPER_ADMIN';
        
        // Strict default: Restricted unless Super Admin
        const isSiteRestricted = !isSuperAdmin; 

        const whereClause: Record<string, unknown> = { isActive: true }

        if (isSiteRestricted) {
            const { searchParams } = new URL(req.url)
            const workOrderId = searchParams.get('workOrderId')

            // Collect user's site IDs (multi-site + legacy)
            const allowedSiteIds: string[] = []
            
            // Multi-site: from userSites relation
            if (user.userSites && user.userSites.length > 0) {
                allowedSiteIds.push(...user.userSites.map(us => us.siteId));
            }
            // Legacy: from sites relation
            else if (user.sites?.id) {
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
                console.log(`[Mobile Gudang] Access Denied: User ${user.email} (Role: ${user.role?.name}) has no site assigned.`);
                return NextResponse.json({ 
                    error: `Halo ${user.name}, akun Anda belum memiliki Site yang ditentukan. Silakan hubungi admin untuk assign Site ke akun Anda agar dapat melihat daftar Gudang.`,
                    code: 'NO_SITE_ASSIGNED',
                    debug: {
                        userId: user.id,
                        role: user.role?.name
                    }
                }, { status: 403 })
            }

            // Filter by Site (User's sites OR WorkOrder's site) using many-to-many relation
            whereClause.sites = {
                some: {
                    id: { in: allowedSiteIds }
                }
            }
        }

        console.log('[Mobile Gudang] User:', user.name, 'Role:', user.role?.name);
        console.log('[Mobile Gudang] isSiteRestricted:', isSiteRestricted);
        console.log('[Mobile Gudang] WhereClause:', JSON.stringify(whereClause, null, 2));

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

        console.log('[Mobile Gudang] Found:', gudangs.length, 'warehouses');
        gudangs.forEach(g => console.log(`- ${g.nama} (Sites: ${g.sites.map(s => s.name).join(', ') || 'NONE'})`));

        return NextResponse.json({ gudangList: gudangs })
    } catch (error) {
        console.error('Error fetching gudangs (mobile):', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
