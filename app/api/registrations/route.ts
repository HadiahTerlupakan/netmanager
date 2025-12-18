import { NextResponse } from 'next/server'
import { RegistrationService } from '@/modules/registration'

/**
 * POST /api/registrations
 * Endpoint untuk pendaftaran pelanggan baru
 * 
 * Body:
 * - name: string (wajib)
 * - email: string (wajib)
 * - phone: string (wajib)
 * - address: string (wajib)
 * - location?: string
 * - packageName?: string
 * - notes?: string
 * - turnstileToken?: string (jika captcha aktif)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Get IP Address from headers
        const forwardedFor = request.headers.get('x-forwarded-for')
        const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1'

        // Delegate to service
        const service = new RegistrationService()
        const result = await service.register({
            ...body,
            ipAddress
        })

        if (result.success) {
            return NextResponse.json(
                { message: 'Pendaftaran berhasil dikirim', data: result.data },
                { status: 201 }
            )
        } else {
            return NextResponse.json(
                { error: result.error },
                { status: result.statusCode || 400 }
            )
        }

    } catch (error: any) {
        console.error('[API Registration] Error:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan internal server.' },
            { status: 500 }
        )
    }
}
