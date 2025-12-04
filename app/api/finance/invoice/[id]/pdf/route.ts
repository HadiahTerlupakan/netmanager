import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { InvoicePDFService } from '@/lib/services/invoice-pdf-service'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { createAuthError, createAuthorizationError, createSecureError, ErrorType } from '@/lib/utils/secure-error-handler'

const pdfService = new InvoicePDFService(prisma)

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        // Proper authentication check
        const authResult = await FinanceAuthService.authenticate(request)
        if (!authResult.success) {
            if (authResult.errorCode === 'FORBIDDEN') {
                return createAuthorizationError(authResult.error)
            }
            return createAuthError(authResult.error)
        }

        const { id: tagihanId } = await context.params

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
        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        })
    } catch (error: any) {
        console.error('Error generating PDF:', error)
        return createSecureError(ErrorType.SYSTEM, 'Failed to generate PDF')
    }
}
