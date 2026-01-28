import { NextRequest, NextResponse } from 'next/server'
import { setCustomerAuthCookies } from '@/lib/customer-auth'
import { CustomerAuthService } from '@/modules/pelanggan/services/CustomerAuthService'

const authService = new CustomerAuthService()

/**
 * POST - Customer login endpoint
 * Refactored to use CustomerAuthService (thin controller pattern)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { identifier, password } = body

        const result = await authService.login(identifier, password)

        if (!result.success) {
            // Determine status code
            let statusCode = 401
            if (result.error?.includes('harus diisi')) statusCode = 400
            if (result.error?.includes('Terlalu banyak')) statusCode = 429
            if (result.error?.includes('belum diaktifkan') || result.error?.includes('tidak aktif')) statusCode = 403

            return NextResponse.json(
                { error: result.error, message: result.message },
                { status: statusCode }
            )
        }

        // Success response
        const responseData = {
            success: true,
            message: 'Login berhasil',
            customer: result.customer,
        }

        const response = NextResponse.json(responseData)

        // Set auth cookies
        if (result.tokens) {
            setCustomerAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken)
        }

        return response
    } catch (error) {
        console.error('[Customer Login Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
