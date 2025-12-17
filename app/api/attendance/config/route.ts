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
                site: {
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
            hasSite: !!user?.site,
            siteName: user?.site?.name,
            lat: user?.site?.latitude,
            lng: user?.site?.longitude,
            radius: user?.site?.attendanceRadius
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                site: user.site
            }
        })
    } catch (error) {
        console.error('Error fetching attendance config:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
