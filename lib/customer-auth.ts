import { NextRequest, NextResponse } from 'next/server'
import { verifyPelangganAccessToken, generatePelangganAccessToken } from './jwt'
import { prisma } from './prisma'

// Cookie names
export const CUSTOMER_ACCESS_TOKEN_COOKIE = 'customer-token'
export const CUSTOMER_REFRESH_TOKEN_COOKIE = 'customer-refresh-token'

// Cookie options
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
}

export interface CustomerSession {
    id: string
    idPelanggan: string
    nama: string
    username: string
    status: string
}

/**
 * Get customer session from request
 */
export async function getCustomerSession(request: NextRequest): Promise<CustomerSession | null> {
    try {
        // Try to get token from cookie
        const token = request.cookies.get(CUSTOMER_ACCESS_TOKEN_COOKIE)?.value

        if (!token) {
            return null
        }

        const decoded = verifyPelangganAccessToken(token)
        if (!decoded) {
            return null
        }

        return {
            id: decoded.id,
            idPelanggan: decoded.idPelanggan,
            nama: decoded.nama,
            username: decoded.username,
            status: decoded.status,
        }
    } catch {
        return null
    }
}

/**
 * Require customer authentication for API routes
 * Returns the customer session or throws an error response
 */
export async function requireCustomerAuth(request: NextRequest): Promise<{
    session: CustomerSession
    response?: never
} | {
    session?: never
    response: NextResponse
}> {
    const session = await getCustomerSession(request)

    if (!session) {
        return {
            response: NextResponse.json(
                { error: 'Unauthorized', message: 'Silakan login terlebih dahulu' },
                { status: 401 }
            ),
        }
    }

    // Check if customer is still active
    if (session.status !== 'AKTIF') {
        return {
            response: NextResponse.json(
                { error: 'Forbidden', message: 'Akun Anda tidak aktif. Hubungi customer service.' },
                { status: 403 }
            ),
        }
    }

    return { session }
}

/**
 * Set customer auth cookies
 */
export function setCustomerAuthCookies(
    response: NextResponse,
    accessToken: string,
    refreshToken?: string
) {
    // Set access token (15 minutes)
    response.cookies.set(CUSTOMER_ACCESS_TOKEN_COOKIE, accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 60 * 15, // 15 minutes
    })

    // Set refresh token if provided (7 days)
    if (refreshToken) {
        response.cookies.set(CUSTOMER_REFRESH_TOKEN_COOKIE, refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 60 * 60 * 24 * 7, // 7 days
        })
    }

    return response
}

/**
 * Clear customer auth cookies
 */
export function clearCustomerAuthCookies(response: NextResponse) {
    response.cookies.delete(CUSTOMER_ACCESS_TOKEN_COOKIE)
    response.cookies.delete(CUSTOMER_REFRESH_TOKEN_COOKIE)
    return response
}

/**
 * Refresh customer access token using refresh token
 */
export async function refreshCustomerToken(request: NextRequest): Promise<{
    accessToken: string
    session: CustomerSession
} | null> {
    try {
        const refreshToken = request.cookies.get(CUSTOMER_REFRESH_TOKEN_COOKIE)?.value

        if (!refreshToken) {
            return null
        }

        // Import here to avoid circular dependency
        const { verifyPelangganRefreshToken } = await import('./jwt')
        const result = await verifyPelangganRefreshToken(refreshToken)

        if (!result.valid) {
            return null
        }

        // Get fresh customer data
        const pelanggan = await prisma.pelanggan.findUnique({
            where: { id: result.id },
            select: {
                id: true,
                idPelanggan: true,
                nama: true,
                username: true,
                status: true,
            },
        })

        if (!pelanggan || pelanggan.status !== 'AKTIF') {
            return null
        }

        // Generate new access token
        const accessToken = generatePelangganAccessToken({
            id: pelanggan.id,
            idPelanggan: pelanggan.idPelanggan,
            nama: pelanggan.nama,
            username: pelanggan.username,
            status: pelanggan.status,
        })

        return {
            accessToken,
            session: {
                id: pelanggan.id,
                idPelanggan: pelanggan.idPelanggan,
                nama: pelanggan.nama,
                username: pelanggan.username,
                status: pelanggan.status,
            },
        }
    } catch {
        return null
    }
}

/**
 * Get customer from database by ID
 */
export async function getCustomerById(customerId: string) {
    return prisma.pelanggan.findUnique({
        where: { id: customerId },
        include: {
            hargaPaket: {
                include: {
                    bandwidth: true,
                    profilePPP: true,
                },
            },
            odp: {
                include: {
                    odcOutput: {
                        include: {
                            odc: {
                                include: {
                                    otbCore: {
                                        include: {
                                            otb: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
}
