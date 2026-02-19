import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { logger } from '@/lib/logger'
import { createHandler, apiSuccess } from '@/lib/api'

const financeService = new FinanceService()

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().optional(),
})

export const GET = createHandler({ auth: true }, async () => {
    const categories = await financeService.getAllCategories()
    return apiSuccess(categories)
})

export const POST = createHandler({
    auth: true,
    schema: categorySchema
}, async (req, ctx) => {
    const { description, ...rest } = ctx.validated
    
    const category = await financeService.createCategory({
        ...rest,
        ...(description ? { description } : {})
    })

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
