import { Prisma as PrismaBilling } from '@prisma/client-billing';
import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import { invoiceSchema } from '@/lib/validations/invoice'
import { randomUUID } from 'crypto'
import { hasPermission } from '@/lib/rbac'
import { logActivitySafe } from '@/lib/logger'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * GET /api/invoices
 * Get all invoices
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const pelangganId = searchParams.get('pelangganId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}

  // RBAC: Check site restrictions
  const user = ctx.session!.user
  const isRestricted = (await hasPermission("invoice:site_only")) && user.role !== 'SUPER_ADMIN'

  if (isRestricted) {
    // Fetch user siteId
    const { prisma: db } = await import('@/lib/prisma');
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    const userSiteId = dbUser?.siteId

    if (userSiteId) {
      where.siteId = userSiteId
    } else {
      // User restricted but no site? Return empty
      return apiSuccess({
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
    ]
  }

  const skip = (page - 1) * limit

  const [invoices, total] = await Promise.all([
    prismaBilling.invoice.findMany({
      where,
      include: {
        invoiceItem: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prismaBilling.invoice.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return apiSuccess({
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
})

/**
 * POST /api/invoices
 * Create new invoice
 */
export const POST = createHandler({
  auth: true,
  schema: invoiceSchema
}, async (req, ctx) => {
  const { items, ...invoiceData } = ctx.validated
  const user = ctx.session!.user

  // Check if pelanggan exists
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: invoiceData.pelangganId },
  })

  if (!pelanggan) {
    return ApiErrors.notFound('Pelanggan')
  }

  // RBAC: Check site restrictions for creation
  let finalSiteId = invoiceData.siteId
  const isRestricted = (await hasPermission("invoice:site_only")) && user.role !== 'SUPER_ADMIN'

  if (isRestricted) {
    // Fetch user siteId
    const { prisma: db } = await import('@/lib/prisma');
    const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    const userSiteId = dbUser?.siteId

    if (!userSiteId) {
      return ApiErrors.forbidden('User tidak memiliki akses site')
    }

    // Ensure Pelanggan belongs to the same site
    if (pelanggan.siteId && pelanggan.siteId !== userSiteId) {
      return ApiErrors.forbidden('Pelanggan tidak berada di site anda')
    }

    finalSiteId = userSiteId
  } else {
    // If not restricted, auto-fill siteId from Pelanggan if not provided
    if (!finalSiteId && pelanggan.siteId) {
      finalSiteId = pelanggan.siteId
    }
  }

  try {
    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

    // Count invoices for this month
    const invoiceCount = await prismaBilling.invoice.count({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedItems = items.map((item: any) => {
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

    const createData: Record<string, unknown> = {
      id: randomUUID(),
      invoiceNumber,
      pelangganId: invoiceData.pelangganId,
      issueDate: new Date(invoiceData.issueDate),
      dueDate: new Date(invoiceData.dueDate),
      status: invoiceData.status,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      createdBy: user.id,
      updatedAt: new Date(),
      invoiceItem: {
        create: processedItems,
      },
    }

    if (invoiceData.notes) createData.notes = invoiceData.notes
    if (invoiceData.terms) createData.terms = invoiceData.terms
    if (finalSiteId) createData.siteId = finalSiteId

    const invoice = await prismaBilling.invoice.create({
      data: createData as PrismaBilling.InvoiceCreateInput,
      include: {
        invoiceItem: true,
        payment: true,
      },
    })

    // System Log
    logActivitySafe({
      action: 'CREATE',
      subject: 'Invoice',
      userId: user.id,
      details: { id: invoice.id, number: invoice.invoiceNumber, total: Number(totalAmount) / 100 }
    })

    // Serialize BigInt for JSON response
    const serializedInvoice = {
      ...invoice,
      subtotal: invoice.subtotal.toString(),
      taxAmount: invoice.taxAmount.toString(),
      discountAmount: invoice.discountAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoiceItem: invoice.invoiceItem.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString()
      }))
    }

    return apiSuccess(serializedInvoice, { status: 201 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating invoice:', error)

    // Handle unique constraint violation
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return ApiErrors.conflict('Nomor invoice sudah digunakan')
    }

    // Handle foreign key constraint violation
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2003') {
      return ApiErrors.badRequest('Pelanggan tidak ditemukan (Foreign Key Error)')
    }

    return ApiErrors.internalError('Terjadi kesalahan server')
  }
})
