// Invoice PDF Generation Service using Puppeteer

import puppeteer from 'puppeteer'
import { PrismaClient } from '@prisma/client'

export interface InvoiceData {
    tagihanId: string
    noTagihan: string
    periodeBulan: number
    periodeTahun: number
    tanggalJatuhTempo: Date
    total: bigint
    status: string

    // Customer info
    pelanggan: {
        nama: string
        alamat: string
        kecamatan: string
        kabupaten: string
        noTelp: string | null
        email: string | null
    }

    // Package info
    hargaPaket: {
        name: string
        harga: bigint
    }

    // Company info (from settings)
    company: {
        name: string
        address: string
        phone: string
        email: string
        logo?: string
    }
}

export class InvoicePDFService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Generate HTML template for invoice
     */
    private generateInvoiceHTML(data: InvoiceData): string {
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
  <title>Invoice ${data.noTagihan}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      padding: 40px;
    }
    
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .company-details {
      font-size: 11px;
      opacity: 0.9;
      line-height: 1.5;
    }
    
    .invoice-title {
      text-align: right;
      font-size: 36px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .content {
      padding: 40px;
    }
    
    .invoice-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    
    .info-section {
      flex: 1;
    }
    
    .info-label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }
    
    .customer-section {
      background: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #10b981;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .customer-name {
      font-size: 16px;
      font-weight: bold;
      color: #111;
      margin-bottom: 8px;
    }
    
    .customer-address {
      font-size: 12px;
      color: #555;
      line-height: 1.6;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table thead {
      background: #f3f4f6;
    }
    
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #10b981;
    }
    
    .items-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .item-description {
      font-weight: 600;
      color: #111;
      margin-bottom: 4px;
    }
    
    .item-period {
      font-size: 11px;
      color: #666;
    }
    
    .text-right {
      text-align: right;
    }
    
    .totals {
      margin-left: auto;
      width: 300px;
      margin-bottom: 40px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .total-row.grand-total {
      background: #10b981;
      color: white;
      padding: 16px 20px;
      margin-top: 8px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
    }
    
    .payment-info {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 30px;
    }
    
    .payment-info-title {
      font-weight: bold;
      color: #92400e;
      margin-bottom: 12px;
      font-size: 13px;
    }
    
    .payment-details {
      font-size: 12px;
      color: #78350f;
      line-height: 1.8;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      background: #f9fafb;
      color: #6b7280;
      font-size: 10px;
      border-top: 1px solid #e5e7eb;
    }
    
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-lunas {
      background: #d1fae5;
      color: #065f46;
    }
    
    .status-belum-lunas {
      background: #fee2e2;
      color: #991b1b;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .invoice-container {
        border: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <div class="company-name">${data.company.name}</div>
        <div class="company-details">
          ${data.company.address}<br>
          Tel: ${data.company.phone} | Email: ${data.company.email}
        </div>
      </div>
      <div class="invoice-title">INVOICE</div>
    </div>
    
    <!-- Content -->
    <div class="content">
      <!-- Invoice Info -->
      <div class="invoice-info">
        <div class="info-section">
          <div class="info-label">Invoice Number</div>
          <div class="info-value">${data.noTagihan}</div>
          
          <div class="info-label">Billing Period</div>
          <div class="info-value">${months[data.periodeBulan - 1]} ${data.periodeTahun}</div>
        </div>
        
        <div class="info-section" style="text-align: right;">
          <div class="info-label">Due Date</div>
          <div class="info-value">${formatDate(data.tanggalJatuhTempo)}</div>
          
          <div class="info-label">Status</div>
          <div>
            <span class="status-badge ${data.status === 'LUNAS' ? 'status-lunas' : 'status-belum-lunas'}">
              ${data.status === 'LUNAS' ? 'PAID' : 'UNPAID'}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Customer Info -->
      <div class="customer-section">
        <div class="section-title">Bill To</div>
        <div class="customer-name">${data.pelanggan.nama}</div>
        <div class="customer-address">
          ${data.pelanggan.alamat}<br>
          ${data.pelanggan.kecamatan}, ${data.pelanggan.kabupaten}
          ${data.pelanggan.noTelp ? `<br>Tel: ${data.pelanggan.noTelp}` : ''}
          ${data.pelanggan.email ? `<br>Email: ${data.pelanggan.email}` : ''}
        </div>
      </div>
      
      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right" style="width: 150px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="item-description">Internet Package - ${data.hargaPaket.name}</div>
              <div class="item-period">Period: ${months[data.periodeBulan - 1]} ${data.periodeTahun}</div>
            </td>
            <td class="text-right">${formatRupiah(data.hargaPaket.harga)}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Totals -->
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatRupiah(data.total)}</span>
        </div>
        <div class="total-row">
          <span>Tax (PPN 11%):</span>
          <span>Rp 0</span>
        </div>
        <div class="total-row grand-total">
          <span>TOTAL AMOUNT:</span>
          <span>${formatRupiah(data.total)}</span>
        </div>
      </div>
      
      <!-- Payment Info -->
      ${data.status === 'BELUM_LUNAS' ? `
      <div class="payment-info">
        <div class="payment-info-title">⚠️ Payment Information</div>
        <div class="payment-details">
          Please make payment before the due date to avoid service disruption.<br>
          <strong>Payment Methods:</strong> Bank Transfer, E-Wallet (OVO, GoPay, DANA), or visit our office.<br>
          <strong>Contact:</strong> ${data.company.phone} | ${data.company.email}
        </div>
      </div>
      ` : `
      <div class="payment-info" style="background: #d1fae5; border-color: #10b981;">
        <div class="payment-info-title" style="color: #065f46;">✓ Payment Received</div>
        <div class="payment-details" style="color: #047857;">
          Thank you for your payment! Your service is active.
        </div>
      </div>
      `}
    </div>
    
    <!-- Footer -->
    <div class="footer">
      This is a computer-generated invoice. No signature required.<br>
      For questions, please contact ${data.company.email} or ${data.company.phone}
    </div>
  </div>
</body>
</html>
    `
    }

    /**
     * Generate PDF from Tagihan
     */
    async generatePDF(tagihanId: string): Promise<Buffer> {
        // Get tagihan data
        const tagihan = await this.prisma.tagihan.findUnique({
            where: { id: tagihanId },
            include: {
                pelanggan: true,
                hargaPaket: true
            }
        })

        if (!tagihan) {
            throw new Error('Tagihan not found')
        }

        // Get company settings (you should have this in your settings/config)
        const companyInfo = {
            name: 'NetManager ISP',
            address: 'Jl. Example No. 123, Jakarta',
            phone: '021-12345678',
            email: 'billing@netmanager.com',
            logo: '/logo.png' // Optional
        }

        // Prepare invoice data
        const invoiceData: InvoiceData = {
            tagihanId: tagihan.id,
            noTagihan: tagihan.noTagihan,
            periodeBulan: tagihan.periodeBulan,
            periodeTahun: tagihan.periodeTahun,
            tanggalJatuhTempo: tagihan.tanggalJatuhTempo,
            total: tagihan.total,
            status: tagihan.status,
            pelanggan: tagihan.pelanggan,
            hargaPaket: tagihan.hargaPaket,
            company: companyInfo
        }

        // Generate HTML
        const html = this.generateInvoiceHTML(invoiceData)

        // Launch Puppeteer browser
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        try {
            const page = await browser.newPage()

            // Set content
            await page.setContent(html, { waitUntil: 'networkidle0' })

            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0mm',
                    right: '0mm',
                    bottom: '0mm',
                    left: '0mm'
                }
            })

            return Buffer.from(pdfBuffer)
        } finally {
            await browser.close()
        }
    }

    /**
     * Generate PDF and save to file system (optional)
     */
    async generateAndSavePDF(tagihanId: string, outputPath: string): Promise<string> {
        const pdfBuffer = await this.generatePDF(tagihanId)
        const fs = require('fs').promises
        await fs.writeFile(outputPath, pdfBuffer)
        return outputPath
    }
}
