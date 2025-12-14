import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateInvoiceSchema, sendInvoiceSchema } from '@/lib/validations/invoice'

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     description: Mengambil invoice berdasarkan ID
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
 *     responses:
 *       200:
 *         description: Invoice berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
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
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        pelanggan: {
          include: {
            hargaPaket: true,
          },
        },
        items: true,
        payments: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/invoices/{id}:
 *   put:
 *     summary: Update invoice
 *     description: Mengupdate invoice yang sudah ada
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
 *               issueDate:
 *                 type: string
 *                 format: date
 *                 description: Tanggal issue invoice
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: Tanggal jatuh tempo
 *               status:
 *                 type: string
 *                 enum: ["DRAFT", "SENT", "OVERDUE", "PAID", "CANCELLED"]
 *                 description: Status invoice
 *               notes:
 *                 type: string
 *                 description: Catatan invoice
 *               terms:
 *                 type: string
 *                 description: Syarat dan ketentuan
 *               taxAmount:
 *                 type: number
 *                 description: Jumlah pajak
 *               discountAmount:
 *                 type: number
 *                 description: Jumlah diskon
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                       description: Deskripsi item
 *                     quantity:
 *                       type: integer
 *                       description: Quantity
 *                     unitPrice:
 *                       type: number
 *                       description: Harga satuan
 *                     itemType:
 *                       type: string
 *                       enum: ["SERVICE", "PRODUCT", "SETUP_FEE", "MONTHLY_FEE", "ONE_TIME_FEE", "OTHER"]
 *                       description: Tipe item
 *     responses:
 *       200:
 *         description: Invoice berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       400:
 *         description: Validation error
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
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
    }

    const body = await req.json()
    const validation = updateInvoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { items, ...updateData } = validation.data

    // Update invoice and items if provided
    let updatedInvoice
    if (items && items.length > 0) {
      // Delete existing items
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id },
      })

      // Calculate totals
      let subtotal = 0n
      const processedItems = items.map(item => {
        const unitPrice = BigInt(Math.round(item.unitPrice * 100)) / 100n
        const totalPrice = BigInt(item.quantity) * unitPrice
        subtotal += totalPrice
        
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          itemType: item.itemType,
        }
      })

      const taxAmount = BigInt(Math.round((updateData.taxAmount || 0) * 100)) / 100n
      const discountAmount = BigInt(Math.round((updateData.discountAmount || 0) * 100)) / 100n
      const totalAmount = subtotal + taxAmount - discountAmount

      updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: {
          ...updateData,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          items: {
            create: processedItems,
          },
        },
        include: {
          pelanggan: {
            include: {
              hargaPaket: true,
            },
          },
          items: true,
          payments: true,
        },
      })
    } else {
      // Just update invoice fields
      updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: updateData,
        include: {
          pelanggan: {
            include: {
              hargaPaket: true,
            },
          },
          items: true,
          payments: true,
        },
      })
    }

    return NextResponse.json(updatedInvoice)
  } catch (error: any) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/invoices/{id}:
 *   delete:
 *     summary: Delete invoice
 *     description: Menghapus invoice
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
 *     responses:
 *       200:
 *         description: Invoice berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invoice berhasil dihapus"
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
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
    }

    // Check if invoice has payments
    const paymentCount = await prisma.payment.count({
      where: { invoiceId: id },
    })

    if (paymentCount > 0) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus invoice yang sudah memiliki pembayaran' },
        { status: 400 }
      )
    }

    // Delete invoice (cascade will delete items)
    await prisma.invoice.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Invoice berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}