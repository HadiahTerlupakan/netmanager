import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'

// Limit file size to 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
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

        const buffer = Buffer.from(await file.arrayBuffer())

        // Create unique filename
        const fileExtension = file.name.split('.').pop()
        const fileName = `${uuidv4()}.${fileExtension}`

        // Ensure upload directory exists
        const uploadDir = join(process.cwd(), 'public/uploads/tickets')
        await mkdir(uploadDir, { recursive: true })

        const filePath = join(uploadDir, fileName)

        await writeFile(filePath, buffer)

        // Return public URL
        const publicUrl = `/uploads/tickets/${fileName}`

        return NextResponse.json({
            success: true,
            url: publicUrl,
            fileName: fileName,
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
