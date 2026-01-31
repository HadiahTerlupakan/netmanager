import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const formData = await request.formData()
        const photo = formData.get('photo') as File

        if (!photo) {
            return apiError('Foto wajib diupload', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (!photo.type.startsWith('image/')) {
            return apiError('File harus berupa gambar', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const MAX_SIZE = 5 * 1024 * 1024 // 5MB
        if (photo.size > MAX_SIZE) {
            return apiError('Ukuran foto maksimal 5MB', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const uploadDir = 'public/uploads/profiles'
        const fileName = `${session.user.id}_${Date.now()}`

        const imageUrl = await convertAndSaveImage(
            photo,
            uploadDir,
            fileName,
            'user-profile',
            session.user.id
        )

        const updated = await prisma.user.update({
            where: { id: session.user.id },
            data: { image: imageUrl },
            select: {
                id: true,
                name: true,
                image: true
            }
        })

        return apiSuccess(updated, { message: 'Foto profil berhasil diperbarui' })
    } catch (error) {
        console.error('Profile photo upload error:', error instanceof Error ? error.message : error)
        return ApiErrors.internalError('Gagal upload foto profil')
    }
}
