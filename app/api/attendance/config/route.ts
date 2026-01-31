import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user || !session.user.id) {
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

        // Site config retrieved - log only in development
        // console.log('[attendance:config] fetched for user', session.user.id)

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
