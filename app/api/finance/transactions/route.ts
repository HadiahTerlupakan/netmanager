import { isSuperAdmin } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { prisma } from '@/lib/prisma'
import { createHandler, apiSuccess } from '@/lib/api'

const financeService = new FinanceService()

const transactionSchema = z.object({
  date: z.string().or(z.date()),
  amount: z.number().min(1, 'Jumlah harus lebih dari 0'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  description: z.string().optional(),
  referenceId: z.string().optional(),
  accountId: z.string().optional(),
})

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const categoryId = searchParams.get('categoryId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const siteIdParam = searchParams.get('siteId') || undefined

    const userPermissions = ctx.permissions || []
    const isSuper = isSuperAdmin(user)
    const isSiteRestricted = userPermissions.includes('finance_transaction:site_only') && !isSuper

    let filterSiteId: string | undefined = siteIdParam
    if (isSiteRestricted) {
        // Fetch user siteId
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { siteId: true }
        });
        const userSiteId = dbUser?.siteId;

        if (!userSiteId) {
             return apiSuccess([])
        }
        filterSiteId = userSiteId
    }

    const transactions = await financeService.getTransactions({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(filterSiteId ? { siteId: filterSiteId } : {})
    })

    return apiSuccess(transactions)
})

export const POST = createHandler({
    auth: true,
    schema: transactionSchema
}, async (req, ctx) => {
    const { date, description, referenceId, accountId, ...rest } = ctx.validated

    const transaction = await financeService.createTransaction({
      ...rest,
      date: date || new Date(),
      createdById: ctx.session!.user.id,
      ...(description ? { description } : {}),
      ...(referenceId ? { referenceId } : {}),
      ...(accountId ? { accountId } : {})
    })

    return apiSuccess(transaction, { status: 201, message: 'Transaksi berhasil dicatat' })
})
