import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user || !session.user.id) {
            return ApiErrors.unauthorized('Sesi tidak valid')
        }

        const { fcmToken, action } = await req.json()
        if (!fcmToken) return ApiErrors.badRequest('fcmToken wajib diisi')

        const userId = session.user.id;

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return ApiErrors.notFound('User tidak ditemukan')

        if (action === 'remove') {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    fcmTokens: {
                        set: user.fcmTokens.filter((t: string) => t !== fcmToken)
                    }
                }
            })
            return apiSuccess(null, { message: 'FCM Token dihapus' })
        }

        if (!user.fcmTokens.includes(fcmToken)) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    fcmTokens: {
                        push: fcmToken
                    }
                }
            })
        }

        return apiSuccess(null, { message: 'FCM Token berhasil disimpan' })

    } catch (error) {
        console.error('Error FCM Token API:', error)
        return ApiErrors.internalError('Terjadi kesalahan pada server')
    }
}
