import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { SiteService } from '@/modules/roles/services/SiteService'

const siteService = new SiteService()

/**
 * GET /api/admin/sites/[id] - Get site details
 * Refactored to use SiteService (thin controller pattern)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('site:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const site = await siteService.getSiteById(id)

        return NextResponse.json({
            success: true,
            data: site,
        })
    } catch (error: any) {
        console.error('Error fetching site:', error)
        
        if (error.message === 'Site not found') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        
        return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/sites/[id] - Update site
 * Refactored to use SiteService (thin controller pattern)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('site:update'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()

        const site = await siteService.updateSite(id, body, user.id)

        return NextResponse.json({
            success: true,
            data: site,
            message: 'Site updated successfully',
        })
    } catch (error: any) {
        console.error('Error updating site:', error)
        
        if (error.message === 'Site not found') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error.message === 'Site code already exists') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        
        return NextResponse.json({ error: 'Failed to update site' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/sites/[id] - Delete site
 * Refactored to use SiteService (thin controller pattern)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('site:delete'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const result = await siteService.deleteSite(id, user.id)

        return NextResponse.json({
            success: true,
            message: result.message,
        })
    } catch (error: any) {
        console.error('Error deleting site:', error)
        
        if (error.message === 'Site not found') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        
        return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 })
    }
}
