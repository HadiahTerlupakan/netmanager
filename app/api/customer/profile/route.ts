import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { PelangganService } from '@/modules/pelanggan'

const pelangganService = new PelangganService()

/**
 * GET - Get customer profile
 * Refactored to use PelangganService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const profile = await pelangganService.getProfile(authResult.session.id)

        return NextResponse.json({
            success: true,
            profile,
        })
    } catch (error: any) {
        console.error('[Customer Profile GET Error]:', error)
        
        if (error.message === 'Data pelanggan tidak ditemukan') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}

/**
 * PATCH - Update customer phone, preferences, or password
 * Refactored to use PelangganService (thin controller pattern)
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

        // Handle password change separately
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Password saat ini harus diisi untuk mengganti password' },
                    { status: 400 }
                )
            }

            await pelangganService.changePassword(
                authResult.session.id,
                currentPassword,
                newPassword
            )

            return NextResponse.json({
                success: true,
                message: 'Password berhasil diubah',
            })
        }

        // Handle profile/preferences update
        const updated = await pelangganService.updateProfile(authResult.session.id, {
            noTelp,
            is2FAEnabled,
            isBillNotifEnabled,
            isPromoEnabled,
        })

        return NextResponse.json({
            success: true,
            message: 'Profil berhasil diupdate',
            updated: {
                noTelp: updated.noTelp,
                updatedAt: updated.updatedAt,
            },
        })
    } catch (error: any) {
        console.error('[Customer Profile PATCH Error]:', error)
        
        // Map known errors to appropriate status codes
        const errorMap: Record<string, number> = {
            'Password saat ini salah': 401,
            'Password baru minimal 6 karakter': 400,
            'Akun tidak memiliki password': 400,
            'Tidak ada data yang diupdate': 400,
        }
        
        const statusCode = errorMap[error.message] || 500
        return NextResponse.json(
            { error: error.message || 'Terjadi kesalahan server' },
            { status: statusCode }
        )
    }
}
