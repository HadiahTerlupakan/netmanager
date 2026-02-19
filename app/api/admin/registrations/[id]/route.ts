import { hasPermission } from '@/lib/rbac'
import { RegistrationRepository } from '@/modules/registration/repositories/RegistrationRepository'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

const registrationRepository = new RegistrationRepository()

/**
 * GET /api/admin/registrations/[id] - Get registration detail
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!(await hasPermission('registration:read'))) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat registrasi')
    }

    const { id } = ctx.params
    const registration = await registrationRepository.findById(id)

    if (!registration) {
        return ApiErrors.notFound('Registrasi')
    }

    return apiSuccess(registration)
})

/**
 * PUT /api/admin/registrations/[id] - Update registration status
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('registration:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah registrasi')
    }

    const { id } = ctx.params
    const body = await req.json()
    const { status, rejectionReason, notes } = body

    if (!status) {
        return apiError('Status wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const current = await registrationRepository.findById(id)
    if (!current) {
        return ApiErrors.notFound('Registrasi')
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
        PENDING: ['VERIFIED', 'REJECTED', 'CANCELLED'],
        VERIFIED: ['SURVEYED', 'CANCELLED'],
        SURVEYED: ['INSTALLED', 'CANCELLED'],
        REJECTED: [],
        INSTALLED: [],
        CANCELLED: [],
    }

    const allowedStatuses = validTransitions[current.status] || []
    if (!allowedStatuses.includes(status)) {
        return apiError(
            `Tidak dapat mengubah status dari ${current.status} ke ${status}`,
            ErrorCodes.BUSINESS_LOGIC_ERROR,
            { status: 400, details: { allowedStatuses } }
        )
    }

    if (status === 'REJECTED' && !rejectionReason) {
        return apiError('Alasan penolakan wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const updated = await registrationRepository.updateWithDetails(id, {
        status,
        notes: notes !== undefined ? notes : current.notes,
        ...(status === 'REJECTED' && rejectionReason ? { rejectionReason } : {}),
        ...(status === 'VERIFIED' ? { 
            verifiedAt: new Date(), 
            verifiedBy: ctx.session!.user.email || 'admin' 
        } : {})
    })

    return apiSuccess(updated, { message: `Status berhasil diubah ke ${status}` })
})

/**
 * DELETE /api/admin/registrations/[id] - Delete registration
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('registration:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus registrasi')
    }

    const { id } = ctx.params
    await registrationRepository.delete(id)

    return apiSuccess(null, { message: 'Registrasi berhasil dihapus' })
})
