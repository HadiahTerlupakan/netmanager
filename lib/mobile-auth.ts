import { SignJWT, jwtVerify } from 'jose'
import { getAppVersionService, type VersionAccessResult } from '@/modules/app-version/services/AppVersionService'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'

const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev'
)

export async function signMobileToken(payload: Record<string, unknown>) {
    // Fetch current tokenVersion from database
    let tokenVersion = 0
    try {
        const id = (payload.id || payload.sub) as string
        const role = payload.role as string | undefined

        // Mitra users are in a separate table, they don't have tokenVersion
        if (role !== 'MITRA') {
            const user = await prisma.user.findUnique({
                where: { id },
                select: { tokenVersion: true }
            })
            tokenVersion = user?.tokenVersion ?? 0
        }
        // Mitra doesn't have tokenVersion, so we keep it at 0
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
    id?: string
    name?: string
    email?: string
    tokenVersion?: number
    appVersionCode?: number
    appVersionName?: string | null
    role?: string
    permissions?: string[]
    isSales?: boolean
    siteId?: string | null
    tenantId?: string | null
    isSuperAdmin?: boolean
    [key: string]: unknown
}

export interface MobileTokenDetails {
    payload: MobileTokenPayload
    versionCode: number
    versionAccess: VersionAccessResult
}

function resolveVersionCode(payload: MobileTokenPayload, versionCodeOverride?: number | null): number {
    if (typeof versionCodeOverride === 'number' && Number.isFinite(versionCodeOverride) && versionCodeOverride > 0) {
        return versionCodeOverride
    }

    const tokenVersionCode = Number(payload.appVersionCode ?? payload.versionCode ?? 0)
    return Number.isFinite(tokenVersionCode) && tokenVersionCode > 0 ? tokenVersionCode : 0
}

export async function getMobileTokenDetails(token: string, versionCodeOverride?: number | null): Promise<MobileTokenDetails | null> {
    try {
        const { payload } = await jwtVerify(token, secret)
        const mobilePayload = payload as MobileTokenPayload
        const versionCode = resolveVersionCode(mobilePayload, versionCodeOverride)
        const versionAccess = await getAppVersionService().evaluateVersionAccess(versionCode)

        return {
            payload: mobilePayload,
            versionCode,
            versionAccess
        }
    } catch (error) {
        console.error('[MOBILE_AUTH] Token parsing failed:', error)
        return null
    }
}

export async function verifyMobileToken(token: string, versionCodeOverride?: number | null): Promise<MobileTokenPayload | null> {
    try {
        console.log('[MOBILE_AUTH] Verifying token...')
        const details = await getMobileTokenDetails(token, versionCodeOverride)
        if (!details) {
            console.log('[MOBILE_AUTH] Token details could not be parsed')
            return null
        }

        const { payload, versionAccess, versionCode } = details
        const userId = (payload.sub || payload.id) as string

        console.log('[MOBILE_AUTH] Token payload verified for user:', userId)

        if (!versionAccess.isSupported) {
            console.log(`[MOBILE_AUTH] App version unsupported for user ${userId}. Version code: ${versionCode}, minimum: ${versionAccess.minimumVersion}`)
            return null
        }

        // Validate tokenVersion against database
        const dbUser = await prisma.user.findUnique({
            where: { id: userId as string },
            select: {
                tokenVersion: true,
                isActive: true,
                isSales: true,
                siteId: true,
                tenantId: true,
                role: {
                    include: {
                        permission: true
                    }
                }
            }
        })

        if (!dbUser) {
            console.log('[MOBILE_AUTH] User not found in User table, checking Pelanggan...', userId)

            // Fallback: Check if it's a Customer
            const customer = await prisma.pelanggan.findUnique({
                where: { id: userId as string },
                select: {
                    id: true,
                    nama: true,
                    username: true,
                    status: true,
                    tokenVersion: true,
                    tenantId: true
                }
            })

            if (customer) {
                console.log('[MOBILE_AUTH] Customer found:', customer.nama)

                if (customer.status !== 'AKTIF') {
                    console.log('[MOBILE_AUTH] Customer is inactive:', userId)
                    return null
                }

                const tokenVersion = (payload.tokenVersion as number) ?? 0
                if (customer.tokenVersion > tokenVersion) {
                    console.log(`[MOBILE_AUTH] Customer token version mismatch for ${userId}. DB: ${customer.tokenVersion}, Token: ${tokenVersion}`)
                    return null
                }

                // Customer permission mapping
                return {
                    ...payload,
                    sub: customer.id,
                    userId: customer.id,
                    role: 'CUSTOMER',
                    permissions: ['customer:read', 'customer:write'], // Basic permissions
                    isSales: false,
                    siteId: null,
                    tenantId: customer.tenantId
                } as unknown as MobileTokenPayload
            }

            console.log('[MOBILE_AUTH] Customer not found, checking Mitra...', userId)
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: userId as string },
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    mitraType: true,
                    siteId: true,
                    tenantId: true
                }
            })

            if (mitra) {
                console.log('[MOBILE_AUTH] Mitra found:', mitra.name)

                if (!mitra.isActive) {
                    console.log('[MOBILE_AUTH] Mitra is inactive:', userId)
                    return null
                }

                return {
                    ...payload,
                    sub: mitra.id,
                    userId: mitra.id,
                    role: 'MITRA',
                    permissions: [], // Will be handled by features in token or logic
                    isSales: mitra.mitraType === 'MITRA_SALES',
                    siteId: mitra.siteId,
                    tenantId: mitra.tenantId
                } as unknown as MobileTokenPayload
            }

            console.log('[MOBILE_AUTH] User/Customer/Mitra not found in DB:', userId)
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

        const permissions = dbUser.role?.permission.map((p: { resource: string; action: string }) => `${p.resource}:${p.action}`) || []
        console.log(`[MOBILE_AUTH] Permissions for ${userId}:`, permissions.length)

        return {
            ...payload,
            sub: userId,
            userId,
            role: dbUser.role?.name,
            permissions,
            isSales: dbUser.isSales,
            siteId: dbUser.siteId,
            tenantId: dbUser.tenantId,
            isSuperAdmin: dbUser.role?.isSuperAdmin ?? false
        } as unknown as MobileTokenPayload
    } catch (error) {
        console.error('[MOBILE_AUTH] Token verification failed:', error)
        return null
    }
}
