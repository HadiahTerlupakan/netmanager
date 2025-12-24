import { NextResponse } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { convertAndSaveBase64 } from '@/lib/utils/image-upload'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const service = new OvertimeService()
        const history = await service.getHistory(session.user.id)

        return NextResponse.json(history)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action } = body // 'request' | 'start' | 'stop'
        const service = new OvertimeService()

        if (!action || action === 'request') {
            // Default: Create Request
            const { date, reason } = body
            if (!date || !reason) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            const result = await service.createRequest(session.user.id, {
                date: new Date(date),
                reason
            })
            return NextResponse.json(result, { status: 201 })
        }

        if (action === 'start') {
            const { overtimeId, photo, location } = body
            if (!overtimeId || !photo) {
                return NextResponse.json({ error: 'Missing required fields (id, photo)' }, { status: 400 })
            }

            // Convert Base64 photo to file/url
            const dateStr = new Date().toISOString().split('T')[0]
            const uploadDir = `public/uploads/overtime/${dateStr}`
            const fileName = `${session.user.id}_start_${Date.now()}`

            const photoUrl = await convertAndSaveBase64(
                photo,
                uploadDir,
                fileName,
                'employee-attendance',
                session.user.id
            )

            const result = await service.startOvertime(session.user.id, overtimeId, {
                photo: photoUrl,
                location
            })
            return NextResponse.json(result)
        }

        if (action === 'stop') {
            const { overtimeId, photo, location } = body
            if (!overtimeId || !photo) {
                return NextResponse.json({ error: 'Missing required fields (id, photo)' }, { status: 400 })
            }

            // Convert Base64 photo to file/url
            const dateStr = new Date().toISOString().split('T')[0]
            const uploadDir = `public/uploads/overtime/${dateStr}`
            const fileName = `${session.user.id}_stop_${Date.now()}`

            const photoUrl = await convertAndSaveBase64(
                photo,
                uploadDir,
                fileName,
                'employee-attendance',
                session.user.id
            )

            const result = await service.stopOvertime(session.user.id, overtimeId, {
                photo: photoUrl,
                location
            })
            return NextResponse.json(result)
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 }
        )
    }
}
