import { NextRequest, NextResponse } from 'next/server'
import { clearCustomerAuthCookies, getCustomerSession } from '@/lib/customer-auth'
import { invalidatePelangganRefreshTokens } from '@/lib/jwt'

export async function POST(request: NextRequest) {
    try {
        const session = await getCustomerSession(request)

        // Invalidate refresh tokens if we have a session
        if (session) {
            await invalidatePelangganRefreshTokens(session.id)
        }

        // Create response
        const response = NextResponse.json({
            success: true,
            message: 'Logout berhasil',
        })

        // Clear auth cookies
        clearCustomerAuthCookies(response)

        return response
    } catch (error) {
        console.error('[Customer Logout Error]:', error)

        // Still clear cookies even on error
        const response = NextResponse.json({
            success: true,
            message: 'Logout berhasil',
        })
        clearCustomerAuthCookies(response)

        return response
    }
}
