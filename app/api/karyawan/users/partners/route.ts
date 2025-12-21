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

        let targetSiteId = ''
        let targetDeptId = ''

        if (workOrderId) {
            const wo = await prisma.workOrder.findUnique({
                where: { id: workOrderId },
                select: { siteId: true, departmentId: true }
            })
            if (wo?.siteId) {
                targetSiteId = wo.siteId
                targetDeptId = wo.departmentId || ''
            }
        }

        if (!targetSiteId) {
            // Fallback to current user's site
            const currentUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { siteId: true, departmentId: true }
            })
            if (currentUser?.siteId) {
                targetSiteId = currentUser.siteId
                targetDeptId = currentUser.departmentId || ''
            }
        }

        if (!targetSiteId) {
            return NextResponse.json({ users: [] })
        }

        // Fetch users from target site
        const users = await prisma.user.findMany({
            where: {
                siteId: targetSiteId,
                // departmentId: targetDeptId, // Allow cross-department partners
                id: { not: session.user.id },
                isActive: true
            },
            select: {
                id: true,
                name: true,
                role: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        return NextResponse.json({ users })
    } catch (error) {
        console.error('Error fetching partners:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
