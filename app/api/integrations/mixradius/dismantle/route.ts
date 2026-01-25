import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { MixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository'
import { onWorkOrderCreated } from '@/modules/work-order/services/WorkOrderNotifications'

const workOrderRepo = new WorkOrderRepository(prisma)

/**
 * POST /api/integrations/mixradius/dismantle
 * 
 * Request dismantle (bongkar) for a MixRadius customer.
 * Creates a Work Order with type DISCONNECTION.
 * 
 * Body: { customerId: string, reason: string, notes?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await verifyAuth(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check - need mixradius:read to view customer AND workorders:create to create WO
    const permissions = await getUserPermissions(session.id)
    const hasAccess = permissions.includes('mixradius:read') && 
                      (permissions.includes('workorders:create') || permissions.includes('list:create'))
    
    if (!hasAccess) {
      console.warn('[Dismantle] Access denied for user:', session.id, 'Permissions:', permissions.filter(p => p.includes('mixradius') || p.includes('workorder') || p.includes('list')))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }


    const body = await req.json()
    const { customerId, reason, notes } = body

    if (!customerId || !reason) {
      return NextResponse.json({ error: 'Customer ID and Reason are required' }, { status: 400 })
    }

    const service = new MixRadiusService()
    
    // 1. Fetch live detail from MixRadius to get latest address/phone
    const mrCustomer = await service.fetchCustomerDetail(customerId)
    if (!mrCustomer) {
      return NextResponse.json({ error: 'Customer not found in MixRadius' }, { status: 404 })
    }

    // 2. Fetch full Requester info and try to find matched local Pelanggan
    const [requester, localPelanggan] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.id },
            select: { id: true, siteId: true }
        }),
        prisma.pelanggan.findFirst({
            where: {
                OR: [
                    { idPelanggan: mrCustomer.member_id },
                    { username: mrCustomer.username }
                ]
            },
            select: { id: true, siteId: true }
        })
    ])

    // 3. Find Technical Department (default to first one if not sure)
    // Or look for department with name containing 'Teknis' or 'Technical'
    const department = await prisma.departments.findFirst({
        where: {
            name: {
                contains: 'Teknis',
                mode: 'insensitive'
            }
        },
        select: { id: true }
    })

    // 4. Create Work Order
    const title = `Request Dismantle: ${mrCustomer.fullname} (${mrCustomer.username})`
    const description = `Permintaan pembongkaran perangkat (dismantle) untuk pelanggan MixRadius.\n\n` +
                        `Alasan: ${reason}\n` +
                        `Catatan: ${notes || '-'}\n\n` +
                        `Data MixRadius:\n` +
                        `- Member ID: ${mrCustomer.member_id}\n` +
                        `- Paket: ${mrCustomer.plan_name}\n` +
                        `- Alamat (Portal): ${mrCustomer.address}`

    // Use requester's siteId if available (Site yang request), fallback to customer's site
    const targetSiteId = requester?.siteId || localPelanggan?.siteId || undefined

    const workOrder = await workOrderRepo.create({
        type: 'DISCONNECTION',
        title: title,
        description: description,
        priority: 'NORMAL',
        pelangganId: localPelanggan?.id || undefined,
        siteId: targetSiteId,
        departmentId: department?.id,
        contactName: mrCustomer.fullname,
        contactPhone: mrCustomer.phonenumber,
        locationAddress: mrCustomer.address,
        disconnectionReason: reason,
        internalNotes: notes || undefined,
        createdById: session.id,
    })

    // 5. Trigger Notifications
    await onWorkOrderCreated({
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
    }).catch(err => console.error('[Dismantle] Notification error:', err))

    // 6. Broadcast via WebSocket
    try {
        const { socketEmitter } = await import('@/lib/websocket/emitter')
        socketEmitter.newWorkOrder({
            id: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            status: workOrder.status,
            priority: workOrder.priority,
            departmentId: workOrder.departmentId || undefined,
            createdAt: workOrder.createdAt.toISOString()
        }, workOrder.departmentId || undefined)
    } catch (e) {
        console.error('[Dismantle] Socket broadcast failed', e)
    }

    return NextResponse.json({
        success: true,
        data: workOrder,
        message: `Work Order ${workOrder.workOrderNumber} berhasil dibuat.`
    })

  } catch (error: any) {
    console.error('[API] Dismantle error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
