import { hasPermission } from '@/lib/rbac'
import { RegistrationRepository } from '@/modules/registration/repositories/RegistrationRepository'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

const registrationRepository = new RegistrationRepository()

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/registrations - List all registrations
 */
export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!(await hasPermission('registration:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat registrasi')
    }

    const registrations = await registrationRepository.findAll()
    return apiSuccess(registrations)
})
