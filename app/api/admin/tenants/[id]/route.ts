import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError, ErrorCodes } from '@/lib/api-response'

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.isSuperAdmin) {
            return apiError('Forbidden', ErrorCodes.UNAUTHORIZED, { status: 403 })
        }

        const body = await req.json()
        const { name, domain, isActive } = body

        if (!name) {
            return apiError('Name is required', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const { id } = await context.params;

        // Check if domain is already used by another tenant
        if (domain) {
            const existingTenant = await prisma.tenant.findFirst({
                where: {
                    domain: domain.toLowerCase(),
                    id: { not: id }
                }
            })
            if (existingTenant) {
                return apiError('Domain is already used by another tenant', ErrorCodes.VALIDATION_ERROR, { status: 400 })
            }
        }

        const tenant = await prisma.tenant.update({
            where: { id },
            data: {
                name,
                domain: domain ? domain.toLowerCase() : null,
                isActive: isActive ?? true
            }
        })

        return NextResponse.json({ 
            success: true, 
            data: tenant,
            message: 'Tenant updated successfully'
        })
    } catch (error: unknown) {
        console.error('[TENANT_PUT]', error)
        const message = error instanceof Error ? error.message : 'Failed to update tenant'
        return apiError(message, ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}


export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        
        if (!session?.user?.isSuperAdmin) {
            return apiError('Forbidden', ErrorCodes.UNAUTHORIZED, { status: 403 })
        }

        const { id } = await context.params;

        // Since tenant might have many references, it's safer to soft-delete
        // But if we want hard delete, it might fail due to FK constraints unless cascading
        // Here we just use hard delete, if it fails, it means there is related data.
        await prisma.tenant.delete({
            where: { id }
        })

        return NextResponse.json({ success: true, message: 'Tenant deleted successfully' })
    } catch (error: unknown) {
        console.error('[TENANT_DELETE]', error)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') { // Foreign key constraint failed
            return apiError('Cannot delete tenant with existing related data (Users, etc.)', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }
        return apiError('Failed to delete tenant', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
