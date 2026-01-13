import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

// POST - Register push token
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }
        
        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const body = await request.json()
        const { pushToken } = body


        if (!pushToken) {
            return NextResponse.json({ error: 'Push token required' }, { status: 400 })
        }

        // Unique Token Enforcement: Remove this token from any other users
        // This prevents "Shared Device" notification leaks
        await prisma.user.updateMany({
            where: { 
                pushToken: pushToken,
                id: { not: user.id }
            },
            data: { 
                pushToken: null, 
                pushTokenUpdatedAt: null 
            }
        })

        // Update user with push token
        await prisma.user.update({
            where: { id: user.id },
            data: { 
                pushToken: pushToken,
                pushTokenUpdatedAt: new Date()
            }
        })

        return NextResponse.json({ success: true, message: 'Push token registered' })

    } catch (error: any) {
        console.error('Push token registration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE - Remove push token (on logout)
export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }
        
        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        // Remove push token
        await prisma.user.update({
            where: { id: user.id },
            data: { 
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })

        return NextResponse.json({ success: true, message: 'Push token removed' })
    } catch (error: any) {
        console.error('Push token removal error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
