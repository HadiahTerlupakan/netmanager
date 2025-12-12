import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { convertAndSaveImage, isImageFile } from '@/lib/utils/image-upload'
import type { UploadType } from '@/lib/utils/image-upload'
import path from 'path'

/**
 * POST /api/upload
 * Generic file upload endpoint
 * Supports: workorder-completion, payment-proofs, etc.
 */
export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const type = formData.get('type') as UploadType | null
        const subFolder = formData.get('workOrderId') as string || formData.get('subFolder') as string || undefined

        // Validate required fields
        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 })
        }

        if (!type) {
            return NextResponse.json({ error: 'Upload type is required' }, { status: 400 })
        }

        // Validate file is an image
        if (!isImageFile(file)) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
        }

        // Generate filename
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const fileName = `${timestamp}_${randomStr}`

        // Determine upload directory based on type
        let uploadDir: string
        switch (type) {
            case 'workorder-completion':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'workorder', 'completion')
                break
            case 'payment-proofs':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'payment-proofs')
                break
            case 'inventory-masuk':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'inventory', 'masuk')
                break
            case 'inventory-keluar':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'inventory', 'keluar')
                break
            case 'employee-attendance':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'employee', 'attendance')
                break
            default:
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'general')
        }

        // If subFolder (e.g., workOrderId), append to path
        if (subFolder) {
            uploadDir = path.join(uploadDir, subFolder)
        }

        // Upload and convert image
        const url = await convertAndSaveImage(
            file,
            uploadDir,
            fileName,
            type,
            subFolder
        )

        return NextResponse.json({
            success: true,
            url,
            fileName: `${fileName}.webp`
        })

    } catch (error: any) {
        console.error('Error uploading file:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to upload file' },
            { status: 500 }
        )
    }
}
