import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { PelangganService } from '@/modules/pelanggan'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const pelangganService = new PelangganService()

/**
 * GET - Get customer profile
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const profile = await pelangganService.getProfile(authResult.session.id)

        return apiSuccess({ profile })
    } catch (error: any) {
        console.error('[Customer Profile GET Error]:', error)
        
        if (error.message === 'Data pelanggan tidak ditemukan') {
            return ApiErrors.notFound('Pelanggan')
        }
        
        return ApiErrors.internalError('Terjadi kesalahan server')
    }
}

/**
 * PATCH - Update customer phone, preferences, or password
 */
export async function PATCH(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const body = await request.json()
        const {
            noTelp,
            currentPassword,
            newPassword,
            is2FAEnabled,
            isBillNotifEnabled,
            isPromoEnabled
        } = body

        if (newPassword) {
            if (!currentPassword) {
                return apiError('Password saat ini harus diisi untuk mengganti password', ErrorCodes.VALIDATION_ERROR, { status: 400 })
            }

            await pelangganService.changePassword(
                authResult.session.id,
                currentPassword,
                newPassword
            )

            return apiSuccess(null, { message: 'Password berhasil diubah' })
        }

        const updated = await pelangganService.updateProfile(authResult.session.id, {
            noTelp,
            is2FAEnabled,
            isBillNotifEnabled,
            isPromoEnabled,
        })

        return apiSuccess({
            noTelp: updated.noTelp,
            updatedAt: updated.updatedAt,
        }, { message: 'Profil berhasil diupdate' })
    } catch (error: any) {
        console.error('[Customer Profile PATCH Error]:', error)
        
        const errorMap: Record<string, number> = {
            'Password saat ini salah': 401,
            'Password baru minimal 6 karakter': 400,
            'Akun tidak memiliki password': 400,
            'Tidak ada data yang diupdate': 400,
        }
        
        const statusCode = errorMap[error.message] || 500
        return apiError(error.message || 'Terjadi kesalahan server', 
            statusCode === 401 ? ErrorCodes.UNAUTHORIZED : 
            statusCode === 400 ? ErrorCodes.VALIDATION_ERROR : 
            ErrorCodes.INTERNAL_ERROR, 
            { status: statusCode }
        )
    }
}
