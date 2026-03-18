import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

function getSecret(): Uint8Array {
    const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    if (!raw) throw new Error('NEXTAUTH_SECRET environment variable is required')
    return new TextEncoder().encode(raw)
}

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('investor_auth_token')?.value

        if (!token) {
            return apiError('Tidak terautentikasi', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        const { payload } = await jwtVerify(token, getSecret())

        return apiSuccess({
            authenticated: true,
            user: {
                id: payload.id,
                username: payload.username,
                namaLengkap: payload.namaLengkap,
                role: payload.role
            }
        })

    } catch {
        return apiError('Tidak terautentikasi', ErrorCodes.UNAUTHORIZED, { status: 401 })
    }
}
