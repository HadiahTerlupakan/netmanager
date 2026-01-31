import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendInvoiceSchema } from '@/lib/validations/invoice'

/**
 * @swagger
 * /api/invoices/{id}/send:
 *   post:
 *     summary: Send invoice to customer
 *     description: Mengirim invoice ke pelanggan via email/WhatsApp
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 description: Email penerima (opsional, akan menggunakan email pelanggan jika kosong)
 *               recipientPhone:
 *                 type: string
 *                 description: Nomor telepon penerima (opsional, akan menggunakan nomor pelanggan jika kosong)
 *               message:
 *                 type: string
 *                 description: Pesan tambahan (opsional)
 *               sendMethod:
 *                 type: string
 *                 enum: ["EMAIL", "WHATSAPP", "BOTH"]
 *                 default: "EMAIL"
 *                 description: Metode pengiriman
 *     responses:
 *       200:
 *         description: Invoice berhasil dikirim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invoice berhasil dikirim"
 *                 sentVia:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["EMAIL"]
 *       400:
 *         description: Validation error atau invoice tidak dapat dikirim
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Invoice tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        pelanggan: true,
        invoiceItem: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
    }

    // Check if invoice is in DRAFT status
    if (invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Hanya invoice dengan status DRAFT yang dapat dikirim' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validation = sendInvoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { recipientEmail, recipientPhone, message: _message, sendMethod } = validation.data

    // Determine recipients
    const email = recipientEmail || invoice.pelanggan.email
    const phone = recipientPhone || invoice.pelanggan.noTelp

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Pelanggan tidak memiliki email atau nomor telepon' },
        { status: 400 }
      )
    }

    const sentVia: string[] = []

    // Send via email
    if (sendMethod === 'EMAIL' || sendMethod === 'BOTH') {
      if (!email) {
        return NextResponse.json(
          { error: 'Email pelanggan tidak tersedia' },
          { status: 400 }
        )
      }

      try {
        // TODO: Implement email sending logic
        // const emailResult = await sendInvoiceEmail(invoice, email, message)
        
        // For now, just log and mark as sent
        console.log(`Sending invoice ${invoice.invoiceNumber} to ${email}`)
        sentVia.push('EMAIL')
      } catch (emailError: unknown) {
        const err = emailError instanceof Error ? emailError : new Error('Unknown error')
        console.error('Error sending email:', err)
        return NextResponse.json(
          { error: `Gagal mengirim email: ${err.message}` },
          { status: 500 }
        )
      }
    }

    // Send via WhatsApp
    if (sendMethod === 'WHATSAPP' || sendMethod === 'BOTH') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Nomor telepon pelanggan tidak tersedia' },
          { status: 400 }
        )
      }

      try {
        // TODO: Implement WhatsApp sending logic
        // const whatsappResult = await sendInvoiceWhatsApp(invoice, phone, message)
        
        // For now, just log and mark as sent
        console.log(`Sending invoice ${invoice.invoiceNumber} to ${phone} via WhatsApp`)
        sentVia.push('WHATSAPP')
      } catch (whatsappError: unknown) {
        const err = whatsappError instanceof Error ? whatsappError : new Error('Unknown error')
        console.error('Error sending WhatsApp:', err)
        return NextResponse.json(
          { error: `Gagal mengirim WhatsApp: ${err.message}` },
          { status: 500 }
        )
      }
    }

    // Update invoice status to SENT and set sentAt
    await prisma.invoice.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Invoice berhasil dikirim',
      sentVia,
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    console.error('Error sending invoice:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}