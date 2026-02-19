import { prisma } from '@/lib/prisma'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const formData = await req.formData()
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
    const fileName = `${ctx.session!.user.id}_${Date.now()}`

    try {
        const imageUrl = await convertAndSaveImage(
            photo,
            uploadDir,
            fileName,
            'user-profile',
            ctx.session!.user.id
        )

        const updated = await prisma.user.update({
            where: { id: ctx.session!.user.id },
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
})
