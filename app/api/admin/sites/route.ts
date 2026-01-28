import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { SiteService } from '@/modules/roles/services/SiteService'

const siteService = new SiteService()

/**
 * GET /api/admin/sites - List all sites
 * Refactored to use SiteService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('site:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const activeOnly = searchParams.get('activeOnly') === 'true'

        const sites = await siteService.getSites({ search, activeOnly })

        return NextResponse.json({
            success: true,
            data: sites,
        })
    } catch (error) {
        console.error('Error fetching sites:', error)
        return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
    }
}

/**
 * POST /api/admin/sites - Create new site
 * Refactored to use SiteService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('site:create'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()

        const site = await siteService.createSite(body, user.id)

        return NextResponse.json({
            success: true,
            data: site,
            message: 'Site created successfully',
        })
    } catch (error: any) {
        console.error('Error creating site:', error)
        
        if (error.message === 'Code and name are required') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error.message === 'Site code already exists') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        
        return NextResponse.json({ error: 'Failed to create site' }, { status: 500 })
    }
}
