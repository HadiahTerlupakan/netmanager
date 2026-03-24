import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, ApiErrors, createHandler } from '@/lib/api'
import { investorPayoutSchema } from '@/lib/validations/investor'

export const GET = createHandler({
    auth: true,
    permissions: ['investors:read']
}, async (req, ctx) => {
    const { id } = ctx.params
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const [payouts, total] = await Promise.all([
        prisma.investorPayout.findMany({
            where: { investorId: id },
            orderBy: { date: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.investorPayout.count({ where: { investorId: id } })
    ])

    return apiPaginated(payouts, { page, limit, total })
})

export const POST = createHandler({
    auth: true,
    permissions: ['investors:create'],
    schema: investorPayoutSchema.omit({ investorId: true })
}, async (req, ctx) => {
    const { id } = ctx.params
    const { amount, date, bankName, accountNumber, accountName, reference, notes, status } = ctx.validated

    const investor = await prisma.investor.findUnique({ where: { id } })
    if (!investor) {
        return ApiErrors.notFound('Investor')
    }

    const payout = await prisma.investorPayout.create({
        data: {
            investorId: id,
            amount: BigInt(amount),
            date: date || new Date(),
            bankName,
            accountNumber,
            accountName,
            reference,
            notes,
            status: status || 'COMPLETED'
        }
    })

    return apiSuccess(payout, { status: 201 })
})
