import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { RegistrationRepository } from '@/modules/registration/repositories/RegistrationRepository'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const registrationRepository = new RegistrationRepository()

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/registrations - List all registrations
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('registration:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat registrasi')
        }

        const registrations = await registrationRepository.findAll()
        return apiSuccess(registrations)
    } catch (error) {
        console.error('Fetch Registrations Error:', error)
        return ApiErrors.internalError('Gagal mengambil data registrasi')
    }
}
