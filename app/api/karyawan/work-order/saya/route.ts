import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - List work orders assigned to current user
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workOrders = await prisma.workOrders.findMany({
            where: {
                OR: [
                    { assignedToId: session.user.id },
                    {
                        assignments: {
                            some: {
                                userId: session.user.id,
                                role: 'PARTNER'
                            }
                        }
                    }
                ],
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] } // Added ON_HOLD just in case
            },
            include: {
                pelanggan: {
                    select: { nama: true }
                },
                assignedTo: {
                    select: { id: true, name: true }
                }
            },
            orderBy: [
                { status: 'asc' },
                { priority: 'desc' },
                { scheduledDate: 'asc' }
            ],
            take: 50
        })

        return NextResponse.json({ workOrders })
    } catch (error) {
        console.error('Error fetching my work orders:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
