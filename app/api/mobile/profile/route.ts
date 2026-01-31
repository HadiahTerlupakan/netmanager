import { NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
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

        const profile = await prisma.user.findUnique({
            where: { id: user.id as string },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                workingHourMode: true,
                startWorkTime: true,
                endWorkTime: true,
                workDays: true,
                canvasingTarget: true,
                isSales: true, // Add isSales flag
                departments: {
                    select: { id: true, name: true }
                },
                sites: {
                    select: { id: true, name: true }
                },
                role: {
                    select: { 
                        id: true, 
                        name: true,
                        permission: {
                            select: {
                                resource: true,
                                action: true
                            }
                        }
                    }
                }
            }
        })

        if (!profile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Extract features with canvasing override logic
        const { getUserFeaturesWithCanvasing } = await import('@/lib/canvasing-access')
        const features = await getUserFeaturesWithCanvasing(profile.id)

        return NextResponse.json({ 
            success: true, 
            data: {
                ...profile,
                features // Array of feature names with canvasing override logic
            }
        })
    } catch (error: unknown) {
        console.error('Profile fetch error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
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
        const { name, phone } = body

        const updateData: { name?: string; phone?: string } = {}
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        const updated = await prisma.user.update({
            where: { id: user.id as string },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true
            }
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error: unknown) {
        console.error('Profile update error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
