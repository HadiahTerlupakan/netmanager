import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const workOrderId = searchParams.get('workOrderId')

        // Fetch users from target site (optional) or all users
        const whereClause: any = {
            id: { not: session.user.id },
            isActive: true
        }

        // If siteId query param is provided, filter by it
        // Otherwise return all (except self)
        const siteId = searchParams.get('siteId')
        if (siteId) {
            whereClause.siteId = siteId
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                site: { select: { id: true, name: true } },
                role: { select: { name: true } }
            },
            orderBy: { name: 'asc' }
        })

        return NextResponse.json({ users })
    } catch (error) {
        console.error('Error fetching partners:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
