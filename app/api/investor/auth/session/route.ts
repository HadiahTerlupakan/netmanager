import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('investor_auth_token')?.value

        if (!token) {
            return NextResponse.json({ authenticated: false }, { status: 401 })
        }

        const { payload } = await jwtVerify(token, secret)

        return NextResponse.json({
            authenticated: true,
            user: {
                id: payload.id,
                username: payload.username,
                namaLengkap: payload.namaLengkap,
                role: payload.role
            }
        }, { status: 200 })

    } catch {
        return NextResponse.json({ authenticated: false }, { status: 401 })
    }
}
