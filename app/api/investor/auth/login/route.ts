import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'

import { prismaAuth } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { checkRateLimit } from '@/lib/redis'

function getSecret(): Uint8Array {
    const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    if (!raw) throw new Error('NEXTAUTH_SECRET environment variable is required')
    return new TextEncoder().encode(raw)
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, password } = body

        if (!username || !password) {
            return apiError('Username dan Password wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Rate limiting
        if (process.env.NODE_ENV === 'production' && process.env.ENABLE_RATE_LIMIT === 'true') {
            const allowed = await checkRateLimit(`investor-login:${username}`, 50, 300)
            if (!allowed) {
                return apiError('Terlalu banyak percobaan. Coba lagi nanti.', ErrorCodes.VALIDATION_ERROR, { status: 429 })
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
            return apiError('Username atau Password salah', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        if (!investor.isActive) {
            return apiError('Akun dinonaktifkan. Silakan hubungi Admin.', ErrorCodes.FORBIDDEN, { status: 403 })
        }

        // Verify password
        let isValid = false
        if (investor.passwordHash) {
            isValid = await compare(password, investor.passwordHash)
        } else {
            // Legacy fallback: passwordHash not yet set, compare plaintext
            // TODO: migrate this investor's password to bcrypt hash
            console.warn(`[INVESTOR_LOGIN] WARNING: Investor ${investor.id} is using legacy plaintext password. Please migrate to bcrypt hash.`)
            isValid = investor.password === password
        }
        if (!isValid) {
            console.log(`[INVESTOR_LOGIN] Invalid password for username: ${username}`)
            return apiError('Username atau Password salah', ErrorCodes.UNAUTHORIZED, { status: 401 })
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
            .sign(getSecret())

        // Set HTTP-only cookie
        const response = apiSuccess({ user: payload }, { message: 'Login berhasil' })

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
        return apiError('Terjadi kesalahan pada server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
