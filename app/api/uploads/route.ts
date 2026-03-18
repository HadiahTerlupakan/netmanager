import { NextRequest } from 'next/server'
import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { getServerSession } from 'next-auth'
import { v4 as uuidv4 } from 'uuid'
import { authConfig } from '@/lib/auth'
import { convertAndSaveImage } from '@/lib/utils/image-upload'

// Limit file size to 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig)

        if (!session?.user?.id) {
            return apiError('Unauthorized', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return apiError('No file uploaded', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Validate request type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return apiError('Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (file.size > MAX_FILE_SIZE) {
            return apiError('File size exceeds 5MB limit.', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Use convertAndSaveImage which handles both Local and R2 storage
        // It also handles webp conversion for optimization
        const uploadDir = 'public/uploads/tickets'
        const _fileExtension = file.name.split('.').pop()
        const uniqueId = uuidv4()

        // Note: convertAndSaveImage will append .webp extension
        // We pass uniqueId as filename

        const publicUrl = await convertAndSaveImage(
            file,
            uploadDir,
            uniqueId,
            'tickets'
        )

        return apiSuccess({
            url: publicUrl,
            fileName: `${uniqueId}.webp`,
            originalName: file.name
        })

    } catch (error) {
        console.error('Upload error:', error)
        return apiError('Failed to upload file', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}

export const config = {
    api: {
        bodyParser: false, // Disabling Next.js body parser is NOT needed for App Router, but good to know context
    },
}
