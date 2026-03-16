import { NextResponse } from 'next/server'
import { prismaAuth } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { checkRateLimit } from '@/lib/redis'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, password } = body

        if (!username || !password) {
            return NextResponse.json(
                { message: 'Username dan Password wajib diisi' },
                { status: 400 }
            )
        }

        // Rate limiting
        if (process.env.NODE_ENV === 'production' && process.env.ENABLE_RATE_LIMIT === 'true') {
            const allowed = await checkRateLimit(`investor-login:${username}`, 50, 300)
            if (!allowed) {
                return NextResponse.json(
                    { message: 'Terlalu banyak percobaan. Coba lagi nanti.' },
                    { status: 429 }
                )
            }
        }

        // Find investor
        const investor = await prismaAuth.investor.findFirst({
            where: { 
                username: {
                    equals: username,
                    mode: 'insensitive'
                }
            }
        })

        if (!investor) {
            console.log(`[INVESTOR_LOGIN] Investor not found for username: ${username}`)
            return NextResponse.json(
                { message: 'Username atau Password salah' },
                { status: 401 }
            )
        }

        if (!investor.isActive) {
            return NextResponse.json(
                { message: 'Akun dinonaktifkan. Silakan hubungi Admin.' },
                { status: 403 }
            )
        }

        // Verify password
        let isValid = false
        if (investor.passwordHash) {
            isValid = await compare(password, investor.passwordHash)
        } else {
            // Fallback for plain text password if hash not yet generated
            isValid = investor.password === password
        }

        if (!isValid) {
            console.log(`[INVESTOR_LOGIN] Invalid password for username: ${username}`)
            return NextResponse.json(
                { message: 'Username atau Password salah' },
                { status: 401 }
            )
        }

        console.log(`[INVESTOR_LOGIN] Login successful for: ${username}, tenantId: ${investor.tenantId}`)

        // Generate JWT Token
        const payload = {
            id: investor.id,
            username: investor.username,
            namaLengkap: investor.namaLengkap,
            role: 'INVESTOR',
            tenantId: investor.tenantId
        }

        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret)

        // Set HTTP-only cookie
        const response = NextResponse.json(
            {
                message: 'Login berhasil',
                user: payload
            },
            { status: 200 }
        )

        response.cookies.set({
            name: 'investor_auth_token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        })

        return response
    } catch (error) {
        console.error('[INVESTOR_LOGIN] Error:', error)
        return NextResponse.json(
            { message: 'Terjadi kesalahan pada server' },
            { status: 500 }
        )
    }
}
