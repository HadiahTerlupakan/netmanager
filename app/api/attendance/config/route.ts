import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                sites: {
                    select: {
                        name: true,
                        latitude: true,
                        longitude: true,
                        attendanceRadius: true
                    }
                }
            }
        })

        console.log('Attendance Config Fetch:', {
            userId: session.user.id,
            hasSite: !!user?.sites,
            siteName: user?.sites?.name,
            lat: user?.sites?.latitude,
            lng: user?.sites?.longitude,
            radius: user?.sites?.attendanceRadius
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                site: user.sites
            }
        })
    } catch (error) {
        console.error('Error fetching attendance config:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
