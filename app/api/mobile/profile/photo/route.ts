import { NextResponse } from 'next/server'
import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage } from '@/lib/utils/image-upload'

export async function POST(request: Request) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const user = authResult

        const formData = await request.formData()
        const photo = formData.get('photo') as File

        if (!photo) {
            return apiError('Foto wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (!photo.type.startsWith('image/')) {
            return apiError('File harus berupa gambar', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const MAX_SIZE = 5 * 1024 * 1024 // 5MB
        if (photo.size > MAX_SIZE) {
            return apiError('Ukuran foto maksimal 5MB', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const uploadDir = 'public/uploads/profiles'
        const fileName = `${user.id}_${Date.now()}`

        const imageUrl = await convertAndSaveImage(
            photo,
            uploadDir,
            fileName,
            'user-profile',
            user.id as string
        )

        const updated = await prisma.user.update({
            where: { id: user.id as string },
            data: { image: imageUrl },
            select: {
                id: true,
                name: true,
                image: true
            }
        })

        return apiSuccess(updated)
    } catch (error: unknown) {
        console.error('Profile photo upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return apiError(errorMessage, ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
