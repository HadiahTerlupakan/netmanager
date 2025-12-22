import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        const { partnerIds } = body

        if (!Array.isArray(partnerIds)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        const workOrder = await prisma.workOrder.findUnique({
            where: { id }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        if (workOrder.assignedToId !== session.user.id) {
            return NextResponse.json({ error: 'Work order ini bukan milik Anda' }, { status: 403 })
        }

        // Validate partners match site/dept requirements
        if (partnerIds.length > 0) {
            // Use Work Order site/dept, or fallback to current user's site/dept
            let targetSiteId = workOrder.siteId
            let targetDeptId = workOrder.departmentId

            if (!targetSiteId) {
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { siteId: true, departmentId: true }
                })
                targetSiteId = currentUser?.siteId || null
                targetDeptId = currentUser?.departmentId || null
            }

            const whereClause: any = {
                id: { in: partnerIds },
                isActive: true
            }
            if (targetSiteId) whereClause.siteId = targetSiteId
            if (targetDeptId) whereClause.departmentId = targetDeptId

            const validPartners = await prisma.user.findMany({
                where: whereClause,
                select: { id: true, name: true, siteId: true, departmentId: true }
            })

            console.log('[Partners] Validation:', {
                requestedIds: partnerIds,
                targetSiteId,
                targetDeptId,
                validPartners: validPartners.map(p => ({ id: p.id, name: p.name, siteId: p.siteId }))
            })

            if (validPartners.length !== partnerIds.length) {
                // Identify incorrect partners
                const validIds = new Set(validPartners.map(p => p.id))
                const invalidIds = partnerIds.filter((id: string) => !validIds.has(id))

                // Fetch names of invalid partners to show in error
                const invalidUsers = await prisma.user.findMany({
                    where: { id: { in: invalidIds } },
                    select: { name: true, siteId: true, departmentId: true }
                })

                const invalidNames = invalidUsers.map(u => u.name).join(', ')

                return NextResponse.json({
                    error: `Partner berikut tidak dapat ditambahkan karena berbeda Site/Departemen: ${invalidNames}`,
                    debug: {
                        requested: partnerIds.length,
                        valid: validPartners.length,
                        targetSiteId,
                        targetDeptId,
                        invalidDetails: invalidUsers
                    }
                }, { status: 400 })
            }
        }

        // Identify new partners to notify
        const existingAssignments = await prisma.workOrderAssignment.findMany({
            where: {
                workOrderId: id,
                role: 'PARTNER'
            },
            select: { userId: true }
        })
        const existingPartnerIds = new Set(existingAssignments.map(a => a.userId))
        const newPartnerIds = partnerIds.filter((pid: string) => !existingPartnerIds.has(pid))

        await prisma.$transaction(async (tx) => {
            // Remove existing partners
            await tx.workOrderAssignment.deleteMany({
                where: {
                    workOrderId: id,
                    role: 'PARTNER'
                }
            })

            // Add new partners with PENDING status
            if (partnerIds.length > 0) {
                await tx.workOrderAssignment.createMany({
                    data: partnerIds.map((userId: string) => ({
                        workOrderId: id,
                        userId: userId,
                        role: 'PARTNER',
                        status: 'PENDING',
                        assignedById: session.user.id
                    }))
                })
            }

            // Create Notifications for NEW partners (with approval request)
            if (newPartnerIds.length > 0) {
                await tx.notification.createMany({
                    data: newPartnerIds.map((userId: string) => ({
                        userId,
                        type: 'PARTNER_REQUEST',
                        title: 'Permintaan Partner Kerja',
                        message: `Anda diminta menjadi partner kerja di Work Order #${workOrder.workOrderNumber || id.substring(0, 8)}. Silakan berikan tanggapan.`,
                        link: `/karyawan/work-order/${id}`,
                        sourceType: 'WORK_ORDER',
                        sourceId: id,
                        createdAt: new Date()
                    }))
                })
            }

            // Log update
            await tx.workOrderUpdate.create({
                data: {
                    workOrderId: id,
                    createdById: session.user.id,
                    updateType: 'PARTNER_UPDATE',
                    message: partnerIds.length > 0
                        ? `Mengupdate partner kerja (${partnerIds.length} orang)`
                        : 'Menghapus semua partner kerja',
                    oldStatus: workOrder.status,
                    newStatus: workOrder.status
                }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error saving partners:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
