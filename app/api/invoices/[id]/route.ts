import { prisma } from '@/lib/prisma'
import { updateInvoiceSchema } from '@/lib/validations/invoice'
import { hasPermission } from '@/lib/rbac'
import { Prisma } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { randomUUID } from 'crypto'

/**
 * GET /api/invoices/{id}
 * Get invoice by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const user = ctx.session!.user

    const invoice = await prisma.invoice.findUnique({
      where: { id },
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

    if (!invoice) {
        return ApiErrors.notFound('Invoice')
    }

    // RBAC: Check site restrictions
    const isRestricted = (await hasPermission("invoice:site_only")) && user.role !== 'SUPER_ADMIN'
    
    if (isRestricted) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        const userSiteId = dbUser?.siteId

        if (invoice.siteId && userSiteId && invoice.siteId !== userSiteId) {
             return ApiErrors.forbidden('Akses ditolak')
        }
        if (!invoice.siteId && invoice.pelanggan.siteId && userSiteId && invoice.pelanggan.siteId !== userSiteId) {
             return ApiErrors.forbidden('Akses ditolak')
        }
    }

    // Serialize BigInt
    const serializedInvoice = {
        ...invoice,
        subtotal: invoice.subtotal.toString(),
        taxAmount: invoice.taxAmount.toString(),
        discountAmount: invoice.discountAmount.toString(),
        totalAmount: invoice.totalAmount.toString(),
        invoiceItem: invoice.invoiceItem.map(item => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice.toString()
        }))
    }

    return apiSuccess(serializedInvoice)
})

/**
 * PUT /api/invoices/{id}
 * Update invoice
 */
export const PUT = createHandler({ 
    auth: true,
    schema: updateInvoiceSchema
}, async (req, ctx) => {
    const { id } = ctx.params
    const user = ctx.session!.user

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return ApiErrors.notFound('Invoice')
    }

    // RBAC: Check site restrictions
    const isRestricted = (await hasPermission("invoice:site_only")) && user.role !== 'SUPER_ADMIN'
    
    let userSiteId: string | undefined
    if (isRestricted) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        userSiteId = dbUser?.siteId || undefined

         if (existingInvoice.siteId && userSiteId && existingInvoice.siteId !== userSiteId) {
             return ApiErrors.forbidden('Akses ditolak')
         }
    }

    const { items, ...updateData } = ctx.validated

    // If restricted, prevent changing siteId or force it to user site
    if (isRestricted && updateData.siteId && updateData.siteId !== userSiteId) {
         return ApiErrors.forbidden('Tidak dapat mengubah site invoice ke site lain')
    }
    // Force valid siteId if updating
    if (isRestricted) {
        if (!existingInvoice.siteId && userSiteId) {
            updateData.siteId = userSiteId
        } else if (existingInvoice.siteId) {
            updateData.siteId = existingInvoice.siteId
        }
    }

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

      // Update invoice
      const { siteId, ...restUpdateData } = updateData
      const updatePayload: Prisma.InvoiceUpdateInput = {
        ...restUpdateData,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
      }
      if (siteId) {
        updatePayload.site = { connect: { id: siteId } }
      }

      updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: updatePayload,
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

      // Create invoice items
      for (const item of processedItems) {
        await prisma.invoiceItem.create({
          data: {
            id: randomUUID(),
            ...item,
            invoiceId: id,
          },
        })
      }
    } else {
      // Just update invoice fields
      const { siteId, ...restUpdateData } = updateData
      const updatePayload: Prisma.InvoiceUpdateInput = { ...restUpdateData }
      if (siteId) {
        updatePayload.site = { connect: { id: siteId } }
      }

      updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: updatePayload,
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
    }

    // System Log
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Invoice',
      userId: user.id,
      details: { id: updatedInvoice.id, number: updatedInvoice.invoiceNumber, updates: updateData }
    })

    // Serialize BigInt
    const serializedInvoice = {
        ...updatedInvoice,
        subtotal: updatedInvoice.subtotal.toString(),
        taxAmount: updatedInvoice.taxAmount.toString(),
        discountAmount: updatedInvoice.discountAmount.toString(),
        totalAmount: updatedInvoice.totalAmount.toString(),
        invoiceItem: updatedInvoice.invoiceItem.map(item => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice.toString()
        }))
    }

    return apiSuccess(serializedInvoice)
})

/**
 * DELETE /api/invoices/{id}
 * Delete invoice
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const user = ctx.session!.user

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return ApiErrors.notFound('Invoice')
    }

    // RBAC: Check site restrictions
    const isRestricted = (await hasPermission("invoice:site_only")) && user.role !== 'SUPER_ADMIN'
    
    if (isRestricted) {
        const { prisma: db } = await import('@/lib/prisma');
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
        const userSiteId = dbUser?.siteId

        if (existingInvoice.siteId && userSiteId && existingInvoice.siteId !== userSiteId) {
             return ApiErrors.forbidden('Akses ditolak')
        }
    }

    // Check if invoice has payments
    const paymentCount = await prisma.payment.count({
      where: { invoiceId: id },
    })

    if (paymentCount > 0) {
      return ApiErrors.badRequest('Tidak dapat menghapus invoice yang sudah memiliki pembayaran')
    }

    // Delete invoice (cascade will delete items)
    await prisma.invoice.delete({
      where: { id },
    })

    // System Log
    logActivitySafe({
      action: 'DELETE',
      subject: 'Invoice',
      userId: user.id,
      details: { id: existingInvoice.id, number: existingInvoice.invoiceNumber }
    })

    return apiSuccess(null, { message: 'Invoice berhasil dihapus' })
})
