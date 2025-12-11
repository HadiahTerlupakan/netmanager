import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InvoicePDFService } from '@/lib/services/invoice-pdf-service'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const tagihanId = id

        const tagihan = await prisma.tagihan.findUnique({
            where: { id: tagihanId },
            include: { pelanggan: true },
        })

        if (!tagihan) {
            return NextResponse.json({ error: 'Tagihan not found' }, { status: 404 })
        }

        // Check for customer access via headers first
        const isPelangganAccess = request.headers.get('x-pelanggan-token')

        console.log('[PDF Route] isPelangganAccess:', !!isPelangganAccess)
        console.log('[PDF Route] Headers:', {
            token: request.headers.get('x-pelanggan-token')?.substring(0, 20) + '...',
            hasData: !!request.headers.get('x-pelanggan-data')
        })

        if (isPelangganAccess) {
            const pelangganData = request.headers.get('x-pelanggan-data')

            if (!pelangganData) {
                console.log('[PDF Route] Missing x-pelanggan-data header')
                return NextResponse.json({ error: 'Unauthorized - Missing pelanggan data' }, { status: 401 })
            }

            try {
                const data = JSON.parse(pelangganData)
                console.log('[PDF Route] Pelanggan ID from header:', data.id)
                console.log('[PDF Route] Tagihan pelangganId:', tagihan.pelangganId)

                if (tagihan.pelangganId !== data.id) {
                    console.log('[PDF Route] Pelanggan ID mismatch')
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
                }
            } catch (e) {
                console.log('[PDF Route] Error parsing pelanggan data:', e)
                return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
            }
        } else {
            // Fallback to admin session check
            const session: any = await getServerSession(authConfig as any)
            if (!session?.user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }

            if (false && session.user.false) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        const pdfService = new InvoicePDFService(prisma)
        const pdfBuffer = await pdfService.generatePDF(tagihanId)

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Invoice-${tagihan.noTagihan}.pdf"`,
            },
        })
    } catch (error: any) {
        console.error('Error generating PDF:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate PDF' },
            { status: 500 }
        )
    }
}
