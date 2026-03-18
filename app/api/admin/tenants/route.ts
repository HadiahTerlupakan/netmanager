import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma, prismaAuth } from '@/lib/prisma'
import { apiError, ErrorCodes } from '@/lib/api-response'
import { provisionTenantData } from '@/modules/mitra/services/TenantProvisioningService'

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

        // Auto-provision default Roles, Permissions, and Settings
        try {
            const result = await provisionTenantData(prismaAuth, tenant.id)
            console.log(`[TENANT_POST] Provisioned tenant ${tenant.name}:`, result)
        } catch (provisionError) {
            console.error(`[TENANT_POST] Warning: Provisioning failed for tenant ${tenant.id}:`, provisionError)
            // Don't fail the creation, just log the warning
        }

        return NextResponse.json({ 
            success: true, 
            data: tenant, 
            message: `Tenant ${tenant.name} berhasil dibuat dengan data default.` 
        })
    } catch (error) {
        console.error('[TENANT_POST]', error)
        return apiError('Failed to create tenant', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}

