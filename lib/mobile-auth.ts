import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function signMobileToken(payload: Record<string, unknown>) {
    // Fetch current tokenVersion from database
    let tokenVersion = 0
    try {
        const id = (payload.id || payload.sub) as string
        const user = await prisma.user.findUnique({
            where: { id },
            select: { tokenVersion: true }
        })
        tokenVersion = user?.tokenVersion ?? 0
    } catch (error) {
        console.error('[MOBILE_AUTH] Error fetching tokenVersion:', error)
    }

    // Set sub (subject) to user id if not already set
    const jwtPayload = {
        ...payload,
        sub: (payload.sub || payload.id) as string,
        tokenVersion
    }
    return await new SignJWT(jwtPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret)
}

export interface MobileTokenPayload {
    sub: string
    userId: string
    tokenVersion?: number
    role?: string
    permissions?: string[]
    isSales?: boolean
    siteId?: string | null
    [key: string]: unknown
}

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
    try {
        console.log('[MOBILE_AUTH] Verifying token...')
        const { payload } = await jwtVerify(token, secret)
        // Support both 'sub' and 'id' for backwards compatibility
        const userId = (payload.sub || payload.id) as string

        console.log('[MOBILE_AUTH] Token payload verified for user:', userId)

        // Validate tokenVersion against database
        const dbUser = await prisma.user.findUnique({
            where: { id: userId as string },
            select: { 
                tokenVersion: true, 
                isActive: true,
                isSales: true,
                siteId: true,
                role: {
                    include: {
                        permission: true
                    }
                }
            }
        })

        if (!dbUser) {
            console.log('[MOBILE_AUTH] User not found in DB:', userId)
            return null
        }

        if (!dbUser.isActive) {
            console.log('[MOBILE_AUTH] User is inactive:', userId)
            return null
        }

        // Check if token version matches (force logout feature)
        const tokenVersion = (payload.tokenVersion as number) ?? 0
        if (dbUser.tokenVersion > tokenVersion) {
            console.log(`[MOBILE_AUTH] Token revoked for user ${userId}. DB version: ${dbUser.tokenVersion}, Token version: ${tokenVersion}`)
            return null
        }

        const permissions = dbUser.role?.permission.map(p => `${p.resource}:${p.action}`) || []
        console.log(`[MOBILE_AUTH] Permissions for ${userId}:`, permissions.length)

        return {
            ...payload,
            sub: userId,
            userId,
            role: dbUser.role?.name,
            permissions,
            isSales: dbUser.isSales,
            siteId: dbUser.siteId
        } as unknown as MobileTokenPayload
    } catch (error) {
        console.error('[MOBILE_AUTH] Token verification failed:', error)
        return null
    }
}
