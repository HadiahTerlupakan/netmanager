import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { EmailService } from '@/lib/services/email-service'
import { InvoicePDFService } from '@/lib/services/invoice-pdf-service'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'FINANCE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: tagihanId } = await context.params
    const body = await request.json()
    const { method = 'email' } = body // 'email' or 'whatsapp' or 'both'

    // Get tagihan with customer details
    const tagihan = await prisma.tagihan.findUnique({
      where: { id: tagihanId },
      include: {
        pelanggan: true
      }
    })

    if (!tagihan) {
      return NextResponse.json({ error: 'Tagihan not found' }, { status: 404 })
    }

    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null }
    }

    // Send via Email
    if (method === 'email' || method === 'both') {
      const customerEmail = tagihan.pelanggan.email

      if (!customerEmail) {
        results.email.error = 'Customer email not found'
      } else {
        try {
          const emailService = new EmailService(prisma)
          const pdfService = new InvoicePDFService(prisma)

          // Generate PDF
          const pdfBuffer = await pdfService.generatePDF(tagihanId)

          // Send email with PDF attachment
          const emailResult = await emailService.sendEmail({
            to: customerEmail,
            subject: `Tagihan ${tagihan.noTagihan} - ${getMonthName(tagihan.periodeBulan)} ${tagihan.periodeTahun}`,
            html: generateEmailHTML(tagihan),
            attachments: [
              {
                filename: `Invoice-${tagihan.noTagihan}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
              }
            ]
          })

          if (emailResult.success) {
            results.email.sent = true
          } else {
            results.email.error = emailResult.error || 'Failed to send email'
          }
        } catch (error: any) {
          results.email.error = error.message
        }
      }
    }

    // Send via WhatsApp
    if (method === 'whatsapp' || method === 'both') {
      const customerPhone = tagihan.pelanggan.noTelp

      if (!customerPhone) {
        results.whatsapp.error = 'Customer phone number not found'
      } else {
        try {
          // WhatsApp integration would go here
          // For now, we'll mark it as not implemented
          results.whatsapp.error = 'WhatsApp integration not configured'
        } catch (error: any) {
          results.whatsapp.error = error.message
        }
      }
    }

    // Determine overall success
    const anySent = results.email.sent || results.whatsapp.sent

    return NextResponse.json({
      success: anySent,
      results,
      message: anySent
        ? 'Invoice sent successfully'
        : 'Failed to send invoice'
    }, { status: anySent ? 200 : 500 })

  } catch (error: any) {
    console.error('Error sending invoice:', error)
    return NextResponse.json(
      { error: 'Failed to send invoice', details: error.message },
      { status: 500 }
    )
  }
}

// Helper functions
function getMonthName(month: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  return months[month - 1]
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function generateEmailHTML(tagihan: any): string {
  const paymentLink = `${process.env.NEXT_PUBLIC_APP_URL}/pelanggan/tagihan/${tagihan.id}/bayar`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tagihan ${tagihan.noTagihan}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background-color: #0ea5e9; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Tagihan Internet</h1>
          <p style="color: #e0f2fe; margin: 10px 0 0 0;">NetManager ISP</p>
        </div>

        <!-- Content -->
        <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            Yth. <strong>${tagihan.pelanggan.nama}</strong>,
          </p>

          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            Berikut adalah tagihan internet Anda untuk bulan <strong>${getMonthName(tagihan.periodeBulan)} ${tagihan.periodeTahun}</strong>:
          </p>

          <!-- Invoice Details -->
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Nomor Tagihan</td>
                <td style="padding: 8px 0; color: #111827; font-weight: bold; text-align: right;">${tagihan.noTagihan}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Periode</td>
                <td style="padding: 8px 0; color: #111827; text-align: right;">${getMonthName(tagihan.periodeBulan)} ${tagihan.periodeTahun}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Jatuh Tempo</td>
                <td style="padding: 8px 0; color: #dc2626; font-weight: bold; text-align: right;">${formatDate(tagihan.jatuhTempo)}</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 15px 0 8px 0; color: #111827; font-size: 18px; font-weight: bold;">Total</td>
                <td style="padding: 15px 0 8px 0; color: #0ea5e9; font-size: 20px; font-weight: bold; text-align: right;">${formatRupiah(Number(tagihan.total))}</td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" style="display: inline-block; background-color: #0ea5e9; color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Bayar Sekarang
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px;">
            Invoice lengkap terlampir dalam file PDF. Anda juga dapat mengunduh invoice atau melakukan pembayaran melalui portal pelanggan.
          </p>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px;">
            Terima kasih atas kepercayaan Anda menggunakan layanan kami.
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Hormat kami,<br>
            <strong style="color: #111827;">Tim NetManager ISP</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 5px 0;">Email ini dikirim otomatis, mohon tidak membalas.</p>
          <p style="margin: 5px 0;">Jika ada pertanyaan, hubungi customer service kami.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
