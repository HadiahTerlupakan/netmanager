// Invoice PDF Generation Service using @react-pdf/renderer
// Migrated from Puppeteer for lower RAM usage (~50MB vs ~500MB)

import * as React from 'react'
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
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

// Styles for PDF
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    padding: 40,
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    backgroundColor: '#10b981',
    padding: 30,
    marginHorizontal: -40,
    marginTop: -40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  companyDetails: {
    fontSize: 10,
    color: '#ffffff',
    opacity: 0.9,
  },
  invoiceTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  // Content
  content: {
    marginTop: 40,
  },
  // Invoice Info
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
  },
  infoSection: {
    flex: 1,
  },
  infoSectionRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: 10,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  // Status badges
  statusPaid: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '6 12',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusUnpaid: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '6 12',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Customer section
  customerSection: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 6,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8,
  },
  customerAddress: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 1.6,
  },
  // Table
  table: {
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
    padding: 12,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 16,
  },
  tableColDescription: {
    flex: 1,
  },
  tableColAmount: {
    width: 150,
    textAlign: 'right',
  },
  itemDescription: {
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 4,
  },
  itemPeriod: {
    fontSize: 11,
    color: '#666666',
  },
  // Totals
  totalsContainer: {
    marginLeft: 'auto',
    width: 300,
    marginBottom: 40,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '8 0',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#10b981',
    color: '#ffffff',
    padding: 16,
    marginTop: 8,
    borderRadius: 6,
  },
  grandTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // Payment info
  paymentInfo: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 20,
    borderRadius: 4,
    marginBottom: 30,
  },
  paymentInfoPaid: {
    backgroundColor: '#d1fae5',
    borderLeftColor: '#10b981',
  },
  paymentInfoTitle: {
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 12,
    fontSize: 13,
  },
  paymentInfoTitlePaid: {
    color: '#065f46',
  },
  paymentDetails: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 1.8,
  },
  paymentDetailsPaid: {
    color: '#047857',
  },
  // Footer
  footer: {
    textAlign: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
    marginHorizontal: -40,
    marginBottom: -40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 10,
    color: '#6b7280',
  },
})

// Helper functions
const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const formatRupiah = (amount: bigint | number): string => {
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(numAmount)
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

// Invoice PDF Document Component
const InvoiceDocument = ({ data }: { data: InvoiceData }) => (
  React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(View, null,
          React.createElement(Text, { style: styles.companyName }, data.company.name),
          React.createElement(Text, { style: styles.companyDetails },
            `${data.company.address}\nTel: ${data.company.phone} | Email: ${data.company.email}`
          )
        ),
        React.createElement(Text, { style: styles.invoiceTitle }, 'INVOICE')
      ),

      // Content
      React.createElement(View, { style: styles.content },
        // Invoice Info
        React.createElement(View, { style: styles.invoiceInfo },
          React.createElement(View, { style: styles.infoSection },
            React.createElement(Text, { style: styles.infoLabel }, 'Invoice Number'),
            React.createElement(Text, { style: styles.infoValue }, data.noTagihan),
            React.createElement(Text, { style: styles.infoLabel }, 'Billing Period'),
            React.createElement(Text, { style: styles.infoValue },
              `${months[data.periodeBulan - 1]} ${data.periodeTahun}`
            )
          ),
          React.createElement(View, { style: styles.infoSectionRight },
            React.createElement(Text, { style: styles.infoLabel }, 'Due Date'),
            React.createElement(Text, { style: styles.infoValue }, formatDate(data.tanggalJatuhTempo)),
            React.createElement(Text, { style: styles.infoLabel }, 'Status'),
            React.createElement(Text, {
              style: data.status === 'LUNAS' ? styles.statusPaid : styles.statusUnpaid
            }, data.status === 'LUNAS' ? 'PAID' : 'UNPAID')
          )
        ),

        // Customer Section
        React.createElement(View, { style: styles.customerSection },
          React.createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
          React.createElement(Text, { style: styles.customerName }, data.pelanggan.nama),
          React.createElement(Text, { style: styles.customerAddress },
            `${data.pelanggan.alamat}\n${data.pelanggan.kecamatan}, ${data.pelanggan.kabupaten}${data.pelanggan.noTelp ? `\nTel: ${data.pelanggan.noTelp}` : ''}${data.pelanggan.email ? `\nEmail: ${data.pelanggan.email}` : ''}`
          )
        ),

        // Items Table
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: styles.tableHeader },
            React.createElement(Text, { style: [styles.tableHeaderText, styles.tableColDescription] }, 'Description'),
            React.createElement(Text, { style: [styles.tableHeaderText, styles.tableColAmount] }, 'Amount')
          ),
          React.createElement(View, { style: styles.tableRow },
            React.createElement(View, { style: styles.tableColDescription },
              React.createElement(Text, { style: styles.itemDescription },
                `Internet Package - ${data.hargaPaket.name}`
              ),
              React.createElement(Text, { style: styles.itemPeriod },
                `Period: ${months[data.periodeBulan - 1]} ${data.periodeTahun}`
              )
            ),
            React.createElement(Text, { style: styles.tableColAmount }, formatRupiah(data.hargaPaket.harga))
          )
        ),

        // Totals
        React.createElement(View, { style: styles.totalsContainer },
          React.createElement(View, { style: styles.totalRow },
            React.createElement(Text, null, 'Subtotal:'),
            React.createElement(Text, null, formatRupiah(data.total))
          ),
          React.createElement(View, { style: styles.totalRow },
            React.createElement(Text, null, 'Tax (PPN 11%):'),
            React.createElement(Text, null, 'Rp 0')
          ),
          React.createElement(View, { style: styles.grandTotal },
            React.createElement(Text, { style: styles.grandTotalText }, 'TOTAL AMOUNT:'),
            React.createElement(Text, { style: styles.grandTotalText }, formatRupiah(data.total))
          )
        ),

        // Payment Info
        data.status === 'BELUM_LUNAS'
          ? React.createElement(View, { style: styles.paymentInfo },
            React.createElement(Text, { style: styles.paymentInfoTitle }, '⚠️ Payment Information'),
            React.createElement(Text, { style: styles.paymentDetails },
              `Please make payment before the due date to avoid service disruption.\nPayment Methods: Bank Transfer, E-Wallet (OVO, GoPay, DANA), or visit our office.\nContact: ${data.company.phone} | ${data.company.email}`
            )
          )
          : React.createElement(View, { style: [styles.paymentInfo, styles.paymentInfoPaid] },
            React.createElement(Text, { style: [styles.paymentInfoTitle, styles.paymentInfoTitlePaid] }, '✓ Payment Received'),
            React.createElement(Text, { style: [styles.paymentDetails, styles.paymentDetailsPaid] },
              'Thank you for your payment! Your service is active.'
            )
          )
      ),

      // Footer
      React.createElement(View, { style: styles.footer },
        React.createElement(Text, { style: styles.footerText },
          `This is a computer-generated invoice. No signature required.\nFor questions, please contact ${data.company.email} or ${data.company.phone}`
        )
      )
    )
  )
)

export class InvoicePDFService {
  constructor(private prisma: PrismaClient) { }

  /**
   * Generate PDF from Tagihan
   */
  async generatePDF(tagihanId: string): Promise<Buffer> {
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
      tanggalJatuhTempo: tagihan.jatuhTempo,
      total: BigInt(tagihan.total),
      status: tagihan.status,
      pelanggan: {
        nama: tagihan.pelanggan.nama,
        alamat: tagihan.pelanggan.alamat || '',
        kecamatan: tagihan.pelanggan.kecamatan || '',
        kabupaten: tagihan.pelanggan.kabupatenKota || '',
        noTelp: tagihan.pelanggan.noTelp,
        email: tagihan.pelanggan.email
      },
      hargaPaket: {
        name: tagihan.pelanggan.hargaPaket.name,
        harga: BigInt(tagihan.pelanggan.hargaPaket.harga)
      },
      company: companyInfo
    }

    // Generate PDF using @react-pdf/renderer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoiceDocument, { data: invoiceData }) as any
    )

    return Buffer.from(pdfBuffer)
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
