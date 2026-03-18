import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { cookies } from 'next/headers'

export async function POST() {
    try {
        const response = apiSuccess(null, { message: 'Logout berhasil' })

        const cookieStore = await cookies()
        cookieStore.delete('investor_auth_token')

        return response
    } catch {
        return apiError('Terjadi kesalahan pada server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
