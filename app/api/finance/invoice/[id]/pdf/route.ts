import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { InvoicePDFService } from '@/lib/services/invoice-pdf-service'

const prisma = new PrismaClient()
const pdfService = new InvoicePDFService(prisma)

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tagihanId = params.id

        // Generate PDF
        const pdfBuffer = await pdfService.generatePDF(tagihanId)

        // Get tagihan for filename
        const tagihan = await prisma.tagihan.findUnique({
            where: { id: tagihanId },
            select: { noTagihan: true }
        })

        const filename = `Invoice-${tagihan?.noTagihan || tagihanId}.pdf`

        // Return PDF as blob
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        })
    } catch (error: any) {
        console.error('Error generating PDF:', error)
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error.message },
            { status: 500 }
        )
    }
}
