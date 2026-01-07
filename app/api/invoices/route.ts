import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invoiceSchema } from '@/lib/validations/invoice'
import { randomUUID } from 'crypto'
import { hasPermission } from '@/lib/rbac'

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: Get all invoices
 *     description: Mengambil daftar semua invoice dengan filter dan pagination
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["DRAFT", "SENT", "OVERDUE", "PAID", "CANCELLED"]
 *         description: Filter by status
 *       - in: query
 *         name: pelangganId
 *         schema:
 *           type: string
 *         description: Filter by pelanggan ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by invoice number or customer name
 *     responses:
 *       200:
 *         description: Daftar invoice berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
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
export async function GET(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const pelangganId = searchParams.get('pelangganId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')

    const where: any = {}
    
    // RBAC: Check site restrictions
    if ((await hasPermission("invoice:site_only")) && session.user.role !== 'SUPER_ADMIN') {
        const userSiteId = (session.user as any).siteId
        if (userSiteId) {
            where.siteId = userSiteId
        } else {
             // User restricted but no site? Return empty
             return NextResponse.json({
                data: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
             })
        }
    }
    if (status) {
      where.status = status
    }
    if (pelangganId) {
      where.pelangganId = pelangganId
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { pelanggan: { nama: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const skip = (page - 1) * limit

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          pelanggan: {
            include: {
              hargaPaket: true,
            },
          },
          invoiceItem: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error: any) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Create new invoice
 *     description: Membuat invoice baru
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pelangganId
 *               - issueDate
 *               - dueDate
 *               - items
 *             properties:
 *               pelangganId:
 *                 type: string
 *                 example: "clx1234567890"
 *                 description: ID pelanggan
 *               issueDate:
 *                 type: string
 *                 format: date
 *                 example: "2023-12-01"
 *                 description: Tanggal issue invoice
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: "2023-12-15"
 *                 description: Tanggal jatuh tempo
 *               status:
 *                 type: string
 *                 enum: ["DRAFT", "SENT", "OVERDUE", "PAID", "CANCELLED"]
 *                 default: "DRAFT"
 *                 description: Status invoice
 *               notes:
 *                 type: string
 *                 description: Catatan invoice
 *               terms:
 *                 type: string
 *                 description: Syarat dan ketentuan
 *               taxAmount:
 *                 type: number
 *                 default: 0
 *                 description: Jumlah pajak
 *               discountAmount:
 *                 type: number
 *                 default: 0
 *                 description: Jumlah diskon
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - description
 *                     - unitPrice
 *                   properties:
 *                     description:
 *                       type: string
 *                       example: "Paket Internet Bulanan"
 *                       description: Deskripsi item
 *                     quantity:
 *                       type: integer
 *                       default: 1
 *                       description: Quantity
 *                     unitPrice:
 *                       type: number
 *                       example: 150000
 *                       description: Harga satuan
 *                     itemType:
 *                       type: string
 *                       enum: ["SERVICE", "PRODUCT", "SETUP_FEE", "MONTHLY_FEE", "ONE_TIME_FEE", "OTHER"]
 *                       default: "SERVICE"
 *                       description: Tipe item
 *     responses:
 *       201:
 *         description: Invoice berhasil dibuat
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
 *         description: Pelanggan tidak ditemukan
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
export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validation = invoiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { items, ...invoiceData } = validation.data

    // Check if pelanggan exists
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: invoiceData.pelangganId },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    // RBAC: Check site restrictions for creation
    let finalSiteId = invoiceData.siteId
    const isRestricted = (await hasPermission("invoice:site_only")) && session.user.role !== 'SUPER_ADMIN'
    
    if (isRestricted) {
         const userSiteId = (session.user as any).siteId
         if (!userSiteId) {
             return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 })
         }
         
         // Ensure Pelanggan belongs to the same site
         if (pelanggan.siteId && pelanggan.siteId !== userSiteId) {
             return NextResponse.json({ error: 'Pelanggan tidak berada di site anda' }, { status: 403 })
         }
         
         // If Pelanggan has no site, maybe prevent? Or allow if user matches?
         // Safer to require Pelanggan site match or at least inherit user site if valid.
         // Let's enforce that we set the invoice siteId to user's siteID
         finalSiteId = userSiteId
    } else {
        // If not restricted, auto-fill siteId from Pelanggan if not provided
        if (!finalSiteId && pelanggan.siteId) {
            finalSiteId = pelanggan.siteId
        }
    }

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

    // Count invoices for this month
    const invoiceCount = await prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, new Date().getMonth(), 1),
          lt: new Date(currentYear, new Date().getMonth() + 1, 1),
        },
      },
    })

    const invoiceNumber = `INV/${currentYear}/${currentMonth}/${String(invoiceCount + 1).padStart(4, '0')}`

    // Calculate totals
    let subtotal = 0n
    const processedItems = items.map(item => {
      const unitPrice = BigInt(Math.round(item.unitPrice * 100)) / 100n
      const totalPrice = BigInt(item.quantity) * unitPrice
      subtotal += totalPrice

      return {
        id: randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        itemType: item.itemType,
      }
    })

    const taxAmount = BigInt(Math.round(invoiceData.taxAmount * 100)) / 100n
    const discountAmount = BigInt(Math.round(invoiceData.discountAmount * 100)) / 100n
    const totalAmount = subtotal + taxAmount - discountAmount

    const invoice = await prisma.invoice.create({
      data: {
        id: randomUUID(),
        invoiceNumber,
        ...invoiceData,
        siteId: finalSiteId,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        createdBy: session.user?.id,
        updatedAt: new Date(),
        invoiceItem: {
          create: processedItems,
        },
      },
      include: {
        pelanggan: {
          include: {
            hargaPaket: true,
          },
        },
        invoiceItem: true,
        payment: true,
      },
    })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Invoice',
        userId: session.user.id,
        details: { id: invoice.id, number: invoice.invoiceNumber, total: Number(totalAmount) / 100 }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    console.error('Error creating invoice:', error)

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nomor invoice sudah digunakan' },
        { status: 400 }
      )
    }

    // Handle foreign key constraint violation
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}