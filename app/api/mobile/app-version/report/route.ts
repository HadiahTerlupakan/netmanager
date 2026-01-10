import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        const session = await verifyAuth(req)
        if (!session || !session.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { versionCode, versionName } = body

        if (!versionCode) {
            return NextResponse.json({ error: 'versionCode is required' }, { status: 400 })
        }

        await prisma.user.update({
            where: { id: session.id },
            data: {
                lastVersionCode: parseInt(versionCode),
                lastVersionName: versionName,
                lastVersionUpdate: new Date()
            }
        })

        return NextResponse.json({ success: true })
        
    } catch (error) {
        console.error('Error reporting app version:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
