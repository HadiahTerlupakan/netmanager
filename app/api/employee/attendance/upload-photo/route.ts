import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import * as path from 'path'
import { prisma } from '@/lib/prisma'

/**
 * Authentication helper - requires EMPLOYEE role
 */
async function requireAuth() {
    const session: any = await getServerSession(authConfig as any)
    if (!session || !['ADMIN', 'EMPLOYEE'].includes(session?.user?.role)) {
        return null
    }
    return session
}

/**
 * POST /api/employee/attendance/upload-photo
 * Upload photos for attendance (check-in/check-out)
 * 
 * Request body (form-data):
 * - photo: File (single file)
 * - action: 'check-in' | 'check-out'
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     url: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        // Authentication
        const session = await requireAuth()
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Get employee ID
        let employeeId = session.user?.employee?.id
        if (!employeeId && session.user?.email) {
            const employee = await prisma.employee.findFirst({
                where: { email: session.user.email }
            })
            employeeId = employee?.id
        }

        if (!employeeId) {
            return NextResponse.json(
                { error: 'Employee record not found' },
                { status: 404 }
            )
        }

        // Parse form data
        const formData = await request.formData()
        const file = formData.get('photo') as File
        const action = formData.get('action') as string

        // Validate
        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'Photo is required' },
                { status: 400 }
            )
        }

        if (!['check-in', 'check-out'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            )
        }

        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
        }

        // Prepare upload directory (local fallback)
        const uploadDir = path.join(
            process.cwd(),
            'public',
            'uploads',
            'employee',
            'attendance',
            new Date().getFullYear().toString(),
            String(new Date().getMonth() + 1).padStart(2, '0')
        )

        // Generate filename
        const timestamp = Date.now()
        const fileName = `${employeeId}_${action}_${timestamp}`

        // Upload/Save
        const url = await convertAndSaveImage(
            file,
            uploadDir,
            fileName,
            'employee-attendance',
            employeeId
        )

        logger.apiRequest('POST', '/api/employee/attendance/upload-photo', 200, Date.now() - startTime, {
            userId: session.user.id,
            employeeId,
            action
        })

        return NextResponse.json({
            success: true,
            data: {
                url
            }
        })

    } catch (error: any) {
        logger.error('Error in attendance photo upload endpoint', error, {
            path: '/api/employee/attendance/upload-photo',
            method: 'POST'
        })

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: 'Failed to process photo upload'
            },
            { status: 500 }
        )
    }
}
