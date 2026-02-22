import { prisma } from '@/lib/prisma';
import { prismaBilling } from '@/lib/prisma-billing';
import { sendInvoiceSchema } from '@/lib/validations/invoice'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

/**
 * POST /api/invoices/{id}/send
 * Send invoice to customer
 */
export const POST = createHandler({ 
    auth: true, 
    schema: sendInvoiceSchema 
}, async (req, ctx) => {
    const { id } = ctx.params
    const user = ctx.session!.user

    // Fetch user siteId for validation
    const { prisma: db } = await import('@/lib/prisma');
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    const userSiteId = dbUser?.siteId

    // Check if invoice exists and belongs to the user's site (if restricted)
    // Note: We're doing a simplified check here assuming if siteId exists on invoice it must match user's siteId if present
    const _where: Record<string, unknown> = { id }
    if (userSiteId) {
        // If user has siteId, prioritize invoices in that site OR invoices with no site (if allowed)
        // For simplicity and security, strict match if invoice has siteId
        // This is a bit looser than previous implementation but functional for `findFirst`
        // Actually, let's just fetch it and check after
    }

    const invoice = await prismaBilling.invoice.findUnique({
      where: { id },
      include: {
        
        invoiceItem: true,
      },
    })

    if (!invoice) {
      return ApiErrors.notFound('Invoice')
    }

    // Site check
    if (userSiteId && invoice.siteId && invoice.siteId !== userSiteId) {
        return ApiErrors.notFound('Invoice') // Hide invoices from other sites
    }

    // Check if invoice is in DRAFT status
    if (invoice.status !== 'DRAFT') {
      return apiError('Hanya invoice dengan status DRAFT yang dapat dikirim', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
    }

    const { recipientEmail, recipientPhone, message: _message, sendMethod } = ctx.validated

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: invoice.pelangganId }
    });


    // Determine recipients
    const email = recipientEmail || (pelanggan as any)?.email
    const phone = recipientPhone || (pelanggan as any)?.noTelp

    if (!email && !phone) {
      return apiError('Pelanggan tidak memiliki email atau nomor telepon', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const sentVia: string[] = []

    // Send via email
    if (sendMethod === 'EMAIL' || sendMethod === 'BOTH') {
      if (!email) {
        return apiError('Email pelanggan tidak tersedia', ErrorCodes.VALIDATION_ERROR, { status: 400 })
      }

      try {
        // TODO: Implement email sending logic
        console.log(`[Invoice] Sending invoice ${invoice.invoiceNumber} via EMAIL`)
        sentVia.push('EMAIL')
      } catch (emailError: unknown) {
        console.error('Error sending email:', emailError)
        return ApiErrors.internalError(`Gagal mengirim email`)
      }
    }

    // Send via WhatsApp
    if (sendMethod === 'WHATSAPP' || sendMethod === 'BOTH') {
      if (!phone) {
        return apiError('Nomor telepon pelanggan tidak tersedia', ErrorCodes.VALIDATION_ERROR, { status: 400 })
      }

      try {
        // TODO: Implement WhatsApp sending logic
        console.log(`[Invoice] Sending invoice ${invoice.invoiceNumber} via WHATSAPP`)
        sentVia.push('WHATSAPP')
      } catch (whatsappError: unknown) {
        console.error('Error sending WhatsApp:', whatsappError)
        return ApiErrors.internalError(`Gagal mengirim WhatsApp`)
      }
    }

    // Update invoice status to SENT and set sentAt
    await prismaBilling.invoice.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    })

    return apiSuccess({
      message: 'Invoice berhasil dikirim',
      sentVia,
    })
})
