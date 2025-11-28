// Invoice Delivery Service - Send invoices via multiple channels
import { PrismaClient } from '@prisma/client'
import { InvoicePDFService } from './invoice-pdf-service'
import { WhatsAppService } from './whatsapp/whatsapp-service'
import { EmailService } from './email-service'

export interface SendInvoiceParams {
    tagihanId: string
    channel: 'whatsapp' | 'email' | 'both'
    recipient?: string // Optional: override default recipient
}

export interface DeliveryResult {
    channel: string
    success: boolean
    messageId?: string
    error?: string
}

export class InvoiceDeliveryService {
    private pdfService: InvoicePDFService
    private whatsappService: WhatsAppService
    private emailService: EmailService

    constructor(private prisma: PrismaClient) {
        this.pdfService = new InvoicePDFService(prisma)
        this.whatsappService = new WhatsAppService(prisma)
        this.emailService = new EmailService(prisma)
    }

    /**
     * Send invoice via specified channel(s)
     */
    async sendInvoice(params: SendInvoiceParams): Promise<DeliveryResult[]> {
        const { tagihanId, channel, recipient } = params
        const results: DeliveryResult[] = []

        console.log('[InvoiceDelivery] Starting sendInvoice:', { tagihanId, channel, recipient })

        // Get tagihan data
        const tagihan = await this.prisma.tagihan.findUnique({
            where: { id: tagihanId },
            include: {
                pelanggan: {
                    include: {
                        hargaPaket: true
                    }
                }
            }
        })

        console.log('[InvoiceDelivery] Tagihan found:', tagihan ? 'Yes' : 'No')

        if (!tagihan) {
            throw new Error('Tagihan not found')
        }

        // Normalize channel to lowercase for comparison
        const normalizedChannel = channel.toLowerCase()

        // Send via WhatsApp
        if (normalizedChannel === 'whatsapp' || normalizedChannel === 'both') {
            console.log('[InvoiceDelivery] Attempting to send via WhatsApp...')
            try {
                const phone = recipient || tagihan.pelanggan.noTelp
                if (!phone) {
                    results.push({
                        channel: 'whatsapp',
                        success: false,
                        error: 'No phone number available'
                    })
                } else {
                    // Send text message with invoice details
                    const message = this.generateWhatsAppMessage(tagihan)
                    const result = await this.whatsappService.sendMessage({
                        phone: this.formatPhoneNumber(phone),
                        message
                    })

                    results.push({
                        channel: 'whatsapp',
                        success: result.success,
                        messageId: result.messageId,
                        error: result.error
                    })
                }
            } catch (error: any) {
                results.push({
                    channel: 'whatsapp',
                    success: false,
                    error: error.message
                })
            }
        }

        // Send via Email
        if (normalizedChannel === 'email' || normalizedChannel === 'both') {
            console.log('[InvoiceDelivery] Attempting to send via Email...')
            try {
                const email = recipient || tagihan.pelanggan.email
                if (!email) {
                    results.push({
                        channel: 'email',
                        success: false,
                        error: 'No email address available'
                    })
                } else {
                    // Generate PDF for email attachment
                    let pdfBuffer: Buffer
                    try {
                        console.log('[InvoiceDelivery] Generating PDF for email...')
                        pdfBuffer = await this.pdfService.generatePDF(tagihanId)
                        console.log('[InvoiceDelivery] PDF generated, size:', pdfBuffer.length)
                    } catch (pdfError: any) {
                        console.error('[InvoiceDelivery] PDF generation failed:', pdfError.message)
                        results.push({
                            channel: 'email',
                            success: false,
                            error: `Failed to generate PDF: ${pdfError.message}`
                        })
                        return results // Skip email sending if PDF generation fails
                    }

                    // Generate email HTML
                    const emailHtml = this.generateEmailHTML(tagihan)

                    // Send email with PDF attachment
                    const result = await this.emailService.sendEmail({
                        to: email,
                        subject: `Invoice ${tagihan.noTagihan} - ${tagihan.pelanggan.nama}`,
                        html: emailHtml,
                        attachments: [{
                            filename: `Invoice-${tagihan.noTagihan}.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }]
                    })

                    results.push({
                        channel: 'email',
                        success: result.success,
                        messageId: result.messageId,
                        error: result.error
                    })
                }
            } catch (error: any) {
                results.push({
                    channel: 'email',
                    success: false,
                    error: error.message
                })
            }
        }

        return results
    }

    /**
     * Generate Email HTML for invoice
     */
    private generateEmailHTML(tagihan: any): string {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]

        const formatRupiah = (amount: bigint | number) => {
            const numAmount = typeof amount === 'bigint' ? Number(amount) : amount
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
            }).format(numAmount)
        }

        const formatDate = (date: Date) => {
            return new Intl.DateTimeFormat('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(date)
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .invoice-info { background: white; padding: 20px; margin-bottom: 20px; border-radius: 6px; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .info-label { font-weight: bold; color: #666; }
        .info-value { color: #111; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .status-lunas { background: #d1fae5; color: #065f46; }
        .status-belum-lunas { background: #fee2e2; color: #991b1b; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .attachment-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>INVOICE</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${tagihan.noTagihan}</p>
        </div>
        <div class="content">
            <p>Yth. <strong>${tagihan.pelanggan.nama}</strong></p>
            
            <div class="invoice-info">
                <div class="info-row">
                    <span class="info-label">Periode</span>
                    <span class="info-value">${months[tagihan.periodeBulan - 1]} ${tagihan.periodeTahun}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Paket</span>
                    <span class="info-value">${tagihan.pelanggan.hargaPaket.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total</span>
                    <span class="info-value"><strong>${formatRupiah(tagihan.total)}</strong></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Jatuh Tempo</span>
                    <span class="info-value">${formatDate(tagihan.jatuhTempo)}</span>
                </div>
                <div class="info-row" style="border-bottom: none;">
                    <span class="info-label">Status</span>
                    <span class="status-badge ${tagihan.status === 'LUNAS' ? 'status-lunas' : 'status-belum-lunas'}">
                        ${tagihan.status === 'LUNAS' ? '✅ LUNAS' : '⚠️ BELUM LUNAS'}
                    </span>
                </div>
            </div>

            ${tagihan.status === 'BELUM_LUNAS' ? `
            <div class="attachment-note">
                <strong>⚠️ Perhatian</strong><br>
                Mohon segera lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari gangguan layanan.<br><br>
                <strong>Metode Pembayaran:</strong> Transfer Bank, E-Wallet (OVO, GoPay, DANA), atau bayar di kantor.
            </div>
            ` : `
            <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin-top: 20px; border-radius: 4px;">
                <strong style="color: #065f46;">✅ Terima kasih!</strong><br>
                <span style="color: #047857;">Pembayaran Anda telah diterima. Layanan Anda aktif.</span>
            </div>
            `}

            <div class="attachment-note" style="background: #e0f2fe; border-color: #0284c7;">
                <strong>📎 Lampiran</strong><br>
                File PDF invoice terlampir dalam email ini. Anda dapat mengunduh dan menyimpannya untuk arsip.
            </div>

            <p class="footer">
                Email ini dikirim otomatis oleh sistem.<br>
                Untuk pertanyaan, silakan hubungi kami.
            </p>
        </div>
    </div>
</body>
</html>
        `
    }

    /**
     * Generate WhatsApp message for invoice
     */
    private generateWhatsAppMessage(tagihan: any): string {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]

        const formatRupiah = (amount: bigint | number) => {
            const numAmount = typeof amount === 'bigint' ? Number(amount) : amount
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
            }).format(numAmount)
        }

        const formatDate = (date: Date) => {
            return new Intl.DateTimeFormat('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(date)
        }

        return `📄 *INVOICE - ${tagihan.noTagihan}*

Yth. ${tagihan.pelanggan.nama}

Detail Tagihan:
━━━━━━━━━━━━━━━━━━━━
📅 Periode: ${months[tagihan.periodeBulan - 1]} ${tagihan.periodeTahun}
📦 Paket: ${tagihan.pelanggan.hargaPaket.name}
💰 Total: ${formatRupiah(tagihan.total)}
⏰ Jatuh Tempo: ${formatDate(tagihan.tanggalJatuhTempo)}
📊 Status: ${tagihan.status === 'LUNAS' ? '✅ LUNAS' : '⚠️ BELUM LUNAS'}

${tagihan.status === 'BELUM_LUNAS' ? `⚠️ Mohon segera lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari gangguan layanan.

Metode Pembayaran:
- Transfer Bank
- E-Wallet (OVO, GoPay, DANA)
- Bayar di kantor` : `✅ Terima kasih atas pembayaran Anda! Layanan Anda aktif.`}

Pertanyaan? Hubungi kami.

_Pesan ini dikirim otomatis oleh sistem._`
    }

    /**
     * Format phone number to WhatsApp format (62xxx)
     */
    private formatPhoneNumber(phone: string): string {
        // Remove all non-numeric characters
        const cleanPhone = phone.replace(/[^0-9]/g, '')

        // Ensure starts with 62 (Indonesia)
        if (cleanPhone.startsWith('0')) {
            return '62' + cleanPhone.substring(1)
        } else if (cleanPhone.startsWith('62')) {
            return cleanPhone
        } else {
            return '62' + cleanPhone
        }
    }
}
