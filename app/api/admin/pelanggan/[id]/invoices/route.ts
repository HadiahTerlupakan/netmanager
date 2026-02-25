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

        const { id: pelangganId } = await params

        // Verify customer exists
        const customer = await prisma.pelanggan.findUnique({
            where: { id: pelangganId }
        })

        if (!customer) {
            return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 })
        }

        // Fetch invoices and their payments
        const invoices = await prismaBilling.invoice.findMany({
            where: { pelangganId },
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
