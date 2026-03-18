import { NextRequest, NextResponse } from 'next/server'
import { prismaBilling } from '@/lib/prisma-billing'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const tenantId = session.user.tenantId
        const isSuperAdmin = session.user.isSuperAdmin

        // Tenant isolation: non-superAdmin users must have a tenantId
        if (!tenantId && !isSuperAdmin) {
            return NextResponse.json({ success: false, error: 'Akses ditolak: tenant tidak teridentifikasi' }, { status: 403 })
        }

        const { id: pelangganId } = await params

        // Verify customer exists and belongs to the caller's tenant
        const customer = await prisma.pelanggan.findUnique({
            where: {
                id: pelangganId,
                // Restrict to caller's tenant to prevent IDOR cross-tenant access.
                // SuperAdmin (no tenantId) is exempt and can access all tenants.
                ...(tenantId ? { tenantId } : {}),
            }
        })

        if (!customer) {
            return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 })
        }

        // Fetch invoices and their payments, scoped to caller's tenant
        const invoices = await prismaBilling.invoice.findMany({
            where: {
                pelangganId,
                ...(tenantId ? { tenantId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                payment: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        return NextResponse.json({ success: true, data: invoices })

    } catch (error: unknown) {
        console.error('Error fetching customer invoices:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan internal server'
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
    }
}
