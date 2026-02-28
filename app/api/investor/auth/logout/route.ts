import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
    try {
        const response = NextResponse.json(
            { message: 'Logout berhasil' },
            { status: 200 }
        )

        const cookieStore = await cookies()
        cookieStore.delete('investor_auth_token')

        return response
    } catch {
        return NextResponse.json(
            { message: 'Terjadi kesalahan pada server' },
            { status: 500 }
        )
    }
}
