import { verifyMobileToken } from '@/lib/mobile-auth'
import { prismaMitra } from '@/lib/prisma-mitra'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return ApiErrors.unauthorized('Token tidak valid')
        }

        const token = authHeader.split(' ')[1];
        const session = await verifyMobileToken(token)

        if (!session || !session.userId || session.role !== 'MITRA') {
            return ApiErrors.unauthorized('Sesi tidak valid atau bukan Mitra')
        }

        const { fcmToken, action } = await req.json()
        if (!fcmToken) return ApiErrors.badRequest('fcmToken wajib diisi')

        const userId = session.userId as string

        const mitra = await prismaMitra.mitra.findUnique({ where: { id: userId } })
        if (!mitra) return ApiErrors.notFound('Mitra tidak ditemukan')

        if (action === 'remove') {
            await prismaMitra.mitra.update({
                where: { id: userId },
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
                where: { id: userId },
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
