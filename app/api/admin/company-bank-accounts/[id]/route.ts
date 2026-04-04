import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/modules/database'

export const PUT = createHandler({
    auth: true,
}, async (req, ctx) => {
    const { session, params } = ctx
    if (!session) return ApiErrors.unauthorized()

    const id = params?.id
    if (!id) {
        return ApiErrors.badRequest('ID account is required')
    }

    const body = await req.json()
    const { bankName, accountNumber, accountName, description, isActive, priority } = body

    const account = await prisma.companyBankAccount.update({
        where: { id },
        data: {
            bankName,
            accountNumber,
            accountName,
            description,
            isActive,
            priority
        }
    })

    return apiSuccess(account)
})

export const DELETE = createHandler({
    auth: true,
}, async (req, ctx) => {
    const { session, params } = ctx
    if (!session) return ApiErrors.unauthorized()

    const id = params?.id
    if (!id) {
        return ApiErrors.badRequest('ID account is required')
    }

    await prisma.companyBankAccount.delete({
        where: { id }
    })

    return apiSuccess(null)
})
