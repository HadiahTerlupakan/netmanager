import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/modules/database'

export const GET = createHandler({
    auth: true,
}, async (req, ctx) => {
    const { session } = ctx
    if (!session) return ApiErrors.unauthorized()

    const accounts = await prisma.companyBankAccount.findMany({
        orderBy: { priority: 'asc' }
    })

    return apiSuccess(accounts)
})

export const POST = createHandler({
    auth: true,
}, async (req, ctx) => {
    const { session } = ctx
    if (!session) return ApiErrors.unauthorized()

    const body = await req.json()
    const { bankName, accountNumber, accountName, description, isActive, priority } = body

    if (!bankName || !accountNumber || !accountName) {
        return ApiErrors.badRequest('Bank name, account number, and account name are required')
    }

    const account = await prisma.companyBankAccount.create({
        data: {
            bankName,
            accountNumber,
            accountName,
            description,
            isActive: isActive ?? true,
            priority: priority ?? 1
        }
    })

    return apiSuccess(account, { status: 201 })
})
