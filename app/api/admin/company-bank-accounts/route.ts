import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import {
    companyBankAccountSchema,
    type CompanyBankAccountInput,
} from '@/lib/validations/settings'
import { getCompanyBankAccountService } from '@/modules/finance'

const service = getCompanyBankAccountService()

export const GET = createHandler({
    auth: true,
}, async (req, ctx) => {
    const { session } = ctx
    if (!session) return ApiErrors.unauthorized()
    if (!await hasPermission('bank_accounts:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat rekening bank perusahaan')
    }

    const result = await service.listAccounts()
    if (!result.success) {
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data)
})

export const POST = createHandler({
    auth: true,
    schema: companyBankAccountSchema,
}, async (_req, ctx) => {
    const { session } = ctx
    if (!session) return ApiErrors.unauthorized()
    if (!await hasPermission('bank_accounts:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah rekening bank perusahaan')
    }

    const result = await service.createAccount(ctx.validated as CompanyBankAccountInput)
    if (!result.success) {
        return ApiErrors.internalError(result.error)
    }

    return apiSuccess(result.data, { status: 201 })
})
