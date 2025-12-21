import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Start working on work order
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await req.json().catch(() => ({}))
        const { partnerIds } = body // Expect array of user IDs

        const workOrder = await prisma.workOrder.findUnique({
            where: { id },
            include: {
                site: true,
                department: true,
            }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        if (workOrder.status !== 'ASSIGNED') {
            return NextResponse.json({ error: 'Work order tidak dalam status ASSIGNED' }, { status: 400 })
        }

        // Validate partners if provided
        let partnerNames: string[] = []
        if (partnerIds && Array.isArray(partnerIds) && partnerIds.length > 0) {
            // Check if user's site/dept matches WO's site/dept requirements (or current user's)
            // Here we assume partners must match the currentUser's context which usually matches WO context for site-based work

            // Fetch validated partners
            const partners = await prisma.user.findMany({
                where: {
                    id: { in: partnerIds },
                    siteId: workOrder.siteId,
                    departmentId: workOrder.departmentId,
                    isActive: true
                },
                select: { id: true, name: true }
            })

            if (partners.length !== partnerIds.length) {
                return NextResponse.json({ error: 'Satu atau lebih partner tidak valid (berbeda site/departemen)' }, { status: 400 })
            }

            partnerNames = partners.map(p => p.name || 'Unknown')
        }

        // Transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
            // Update status to IN_PROGRESS
            await tx.workOrder.update({
                where: { id },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: new Date()
                }
            })

            // Add assignments for partners
            if (partnerIds && Array.isArray(partnerIds) && partnerIds.length > 0) {
                await tx.workOrderAssignment.createMany({
                    data: partnerIds.map((userId: string) => ({
                        workOrderId: id,
                        userId: userId,
                        role: 'PARTNER',
                        assignedById: session.user.id
                    }))
                })
            }

            // Create update log
            const partnerMsg = partnerNames.length > 0 ? ` bersama partner: ${partnerNames.join(', ')}` : ''
            await tx.workOrderUpdate.create({
                data: {
                    workOrderId: id,
                    createdById: session.user.id,
                    updateType: 'STATUS_CHANGE',
                    message: `Mulai mengerjakan${partnerMsg}`,
                    oldStatus: 'ASSIGNED',
                    newStatus: 'IN_PROGRESS'
                }
            })
        })

        // Fetch updated WO
        const updated = await prisma.workOrder.findUnique({
            where: { id },
            include: {
                assignments: {
                    include: { user: true }
                }
            }
        })

        // System Log (Fire and forget)
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: session.user.id,
                details: { id, action: 'START_WORK', status: 'IN_PROGRESS', partners: partnerIds }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({ success: true, workOrder: updated })
    } catch (error) {
        console.error('Error starting work order:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
