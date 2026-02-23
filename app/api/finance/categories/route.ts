import { Prisma as PrismaBilling } from '@/prisma/generated/billing';
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { logger } from '@/lib/logger'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prismaBilling } from '@/lib/prisma-billing';

const financeService = new FinanceService()

const categorySchema = z.object({
    name: z.string().min(1, 'Nama kategori wajib diisi'),
    type: z.enum(['INCOME', 'EXPENSE']),
    expenseType: z.enum(['OPERATIONAL', 'CAPITAL', 'OTHER']).optional().nullable(),
    description: z.string().optional().nullable(),
})

export const GET = createHandler({ auth: true }, async () => {
    const categories = await financeService.getAllCategories()
    return apiSuccess(categories)
})

export const POST = createHandler({
    auth: true,
    schema: categorySchema
}, async (req, ctx) => {
    const { description, expenseType, ...rest } = ctx.validated

    const categoryData: PrismaBilling.TransactionCategoryCreateInput = {
        ...rest,
        ...(description ? { description } : {}),
        ...(rest.type === 'EXPENSE' && expenseType ? { expenseType } : {}),
    }

    const category = await financeService.createCategory(categoryData)

    if (ctx.session?.user?.id) {
        await logger.logActivity({
            action: 'CREATE',
            subject: 'FinanceCategory',
            details: { id: category.id, name: category.name, type: category.type },
            userId: ctx.session.user.id
        })
    }

    return apiSuccess(category, { status: 201 })
})

export const PUT = createHandler({
    auth: true,
    schema: categorySchema
}, async (req, ctx) => {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) return ApiErrors.badRequest('ID Kategori wajib diisi')

    const { description, expenseType, ...rest } = ctx.validated

    const categoryData: PrismaBilling.TransactionCategoryUpdateInput = {
        ...rest,
        ...(description ? { description } : {}),
        ...(rest.type === 'EXPENSE' && expenseType ? { expenseType } : {}),
    }

    const category = await financeService.updateCategory(id, categoryData)

    if (ctx.session?.user?.id) {
        await logger.logActivity({
            action: 'UPDATE',
            subject: 'FinanceCategory',
            details: { id: category.id, name: category.name, type: category.type },
            userId: ctx.session.user.id
        })
    }

    return apiSuccess(category)
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) return ApiErrors.badRequest('ID Kategori wajib diisi')

    // Periksa apakah kategori sedang digunakan di tabel Transaction
    const usedCount = await prismaBilling.transaction.count({
        where: { categoryId: id }
    })

    if (usedCount > 0) {
        return ApiErrors.badRequest('Tidak bisa dihapus. Kategori ini sedang digunakan oleh transaksi.')
    }

    // Hapus kategori
    await prismaBilling.transactionCategory.delete({
        where: { id }
    })

    if (ctx.session?.user?.id) {
        await logger.logActivity({
            action: 'DELETE',
            subject: 'FinanceCategory',
            details: { id },
            userId: ctx.session.user.id
        })
    }

    return apiSuccess({ message: 'Kategori berhasil dihapus' })
})
