import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { InvoicePDFService } from '@/lib/services/invoice-pdf-service'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { createSecureErrorResponse } from '@/lib/utils/secure-error-handler'

const pdfService = new InvoicePDFService(prisma)

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Proper authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            return createSecureErrorResponse(
                authResult.error || 'Authentication failed',
                authResult.errorCode || 'UNAUTHORIZED',
                401
            )
        }

        const tagihanId = params.id

        // Log financial access
        await FinanceAuthService.logFinancialAccess(
            request,
            authResult.user!,
            'READ',
            'INVOICE_PDF',
            { tagihanId }
        )

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
        return createSecureErrorResponse(
            'Failed to generate PDF',
            'INTERNAL_ERROR',
            500
        )
    }
}
