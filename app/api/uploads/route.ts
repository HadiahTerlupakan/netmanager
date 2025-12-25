import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { convertAndSaveImage } from '@/lib/utils/image-upload'

// Limit file size to 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: NextRequest) {
    try {
        const formData: any = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            )
        }

        // Validate request type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.' },
                { status: 400 }
            )
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds 5MB limit.' },
                { status: 400 }
            )
        }

        // Use convertAndSaveImage which handles both Local and R2 storage
        // It also handles webp conversion for optimization
        const uploadDir = 'public/uploads/tickets'
        const fileExtension = file.name.split('.').pop()
        const uniqueId = uuidv4()

        // Note: convertAndSaveImage will append .webp extension
        // We pass uniqueId as filename

        const publicUrl = await convertAndSaveImage(
            file,
            uploadDir,
            uniqueId,
            'tickets'
        )

        return NextResponse.json({
            success: true,
            url: publicUrl,
            fileName: `${uniqueId}.webp`,
            originalName: file.name
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        )
    }
}

export const config = {
    api: {
        bodyParser: false, // Disabling Next.js body parser is NOT needed for App Router, but good to know context
    },
}
