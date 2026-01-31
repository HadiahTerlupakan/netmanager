import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { RegistrationRepository } from '@/modules/registration/repositories/RegistrationRepository'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

interface RouteParams {
    params: Promise<{ id: string }>
}

const registrationRepository = new RegistrationRepository()

/**
 * GET /api/admin/registrations/[id] - Get registration detail
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('registration:read'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat registrasi')
        }

        const { id } = await params
        const registration = await registrationRepository.findById(id)

        if (!registration) {
            return ApiErrors.notFound('Registrasi')
        }

        return apiSuccess(registration)
    } catch (error) {
        console.error('Get Registration Error:', error)
        return ApiErrors.internalError('Gagal mengambil data registrasi')
    }
}

/**
 * PUT /api/admin/registrations/[id] - Update registration status
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('registration:update'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah registrasi')
        }

        const { id } = await params
        const body = await request.json()
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
                verifiedBy: session.user?.email || 'admin' 
            } : {})
        })

        return apiSuccess(updated, { message: `Status berhasil diubah ke ${status}` })
    } catch (error) {
        console.error('Update Registration Error:', error)
        return ApiErrors.internalError('Gagal memperbarui registrasi')
    }
}

/**
 * DELETE /api/admin/registrations/[id] - Delete registration
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!(await hasPermission('registration:delete'))) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus registrasi')
        }

        const { id } = await params
        await registrationRepository.delete(id)

        return apiSuccess(null, { message: 'Registrasi berhasil dihapus' })
    } catch (error) {
        console.error('Delete Registration Error:', error)
        return ApiErrors.internalError('Gagal menghapus registrasi')
    }
}
