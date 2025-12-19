import { NextResponse } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
            const result = await service.startOvertime(session.user.id, overtimeId, {
                photo,
                location
            })
            return NextResponse.json(result)
        }

        if (action === 'stop') {
            const { overtimeId, photo, location } = body
            if (!overtimeId || !photo) {
                return NextResponse.json({ error: 'Missing required fields (id, photo)' }, { status: 400 })
            }
            const result = await service.stopOvertime(session.user.id, overtimeId, {
                photo,
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
