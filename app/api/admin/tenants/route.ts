import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, ErrorCodes } from '@/lib/api-response'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        // Strict check: Only Super Admin can access Tenant APIs
        if (!session?.user?.isSuperAdmin) {
            return apiError('Forbidden', ErrorCodes.UNAUTHORIZED, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('active') === 'true'

        // Raw Prisma client to fetch tenants since this is a system-level query
        const tenants = await prisma.tenant.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({ success: true, data: tenants })
    } catch (error) {
        console.error('[TENANT_GET]', error)
        return apiError('Failed to fetch tenants', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}



export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        
        // Strict check: Only Super Admin can access
        if (!session?.user?.isSuperAdmin) {
            return apiError('Forbidden', ErrorCodes.UNAUTHORIZED, { status: 403 })
        }

        const body = await request.json()
        const { name, domain, isActive } = body

        if (!name) {
            return apiError('Name is required', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Create Tenant
        const tenant = await prisma.tenant.create({
            data: {
                name,
                domain: domain || null,
                isActive: isActive ?? true
            }
        })

        return NextResponse.json({ 
            success: true, 
            data: tenant, 
            message: `Tenant ${tenant.name} berhasil dibuat.` 
        })
    } catch (error) {
        console.error('[TENANT_POST]', error)
        return apiError('Failed to create tenant', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
