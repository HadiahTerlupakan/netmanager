import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prismaMitra } from '@/modules/database'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function POST(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const session = authResult
        if (!session.userId || session.role !== 'MITRA') {
            return ApiErrors.unauthorized('Sesi tidak valid atau bukan Mitra')
        }

        const { fcmToken, action } = await req.json()
        if (!fcmToken) return ApiErrors.badRequest('fcmToken wajib diisi')

        const userId = session.userId as string
        const tenantId = session.tenantId

        const mitra = await prismaMitra.mitra.findFirst({
            where: { 
                id: userId,
                tenantId: tenantId
            }
        })
        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')

        if (action === 'remove') {
            await prismaMitra.mitra.update({
                where: { 
                    id: userId,
                    tenantId: tenantId
                },
                data: {
                    fcmTokens: {
                        set: mitra.fcmTokens.filter(t => t !== fcmToken)
                    }
                }
            })
            return apiSuccess(null, { message: 'FCM Token Mitra dihapus' })
        }

        if (!mitra.fcmTokens.includes(fcmToken)) {
            await prismaMitra.mitra.update({
                where: { 
                    id: userId,
                    tenantId: tenantId
                },
                data: {
                    fcmTokens: {
                        push: fcmToken
                    }
                }
            })
        }

        return apiSuccess(null, { message: 'FCM Token Mitra berhasil disimpan' })

    } catch (error) {
        console.error('Error FCM Token Mitra API:', error)
        return ApiErrors.internalError('Terjadi kesalahan pada server')
    }
}
