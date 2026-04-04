import { prisma } from '@/lib/prisma'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { MixRadiusService } from '@/modules/integrations'
import { WorkOrderRepository } from '@/modules/work-order'
import { onWorkOrderCreated } from '@/modules/work-order'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'
import * as crypto from 'crypto'

export const dynamic = 'force-dynamic'

const workOrderRepo = new WorkOrderRepository(prisma)

/**
 * POST /api/integrations/mixradius/dismantle
 * Request dismantle (bongkar) for a MixRadius customer.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)

    // Permission check
    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
      const hasAccess = permissions.includes('*') || (
        permissions.includes('mixradius:read') &&
        (permissions.includes('workorders:create') || permissions.includes('list:create'))
      )

      if (!hasAccess) {
        return ApiErrors.forbidden()
      }
    }

    const body = await req.json()
    const { customerId, reason, notes } = body

    const missingFields: string[] = []
    if (!customerId) missingFields.push('ID Pelanggan')
    if (!reason) missingFields.push('Alasan Bongkar')

    if (missingFields.length > 0) {
      return apiError(
        `Data berikut wajib diisi: ${missingFields.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR,
        { details: { missingFields }, status: 400 }
      )
    }

    const service = new MixRadiusService()
    
    const mrCustomer = await service.fetchCustomerDetail(customerId)
    if (!mrCustomer) {
      return ApiErrors.notFound('Pelanggan tidak ditemukan di MixRadius')
    }

    const [requester, localPelanggan] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
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

    const department = await prisma.departments.findFirst({
        where: {
            name: {
                contains: 'Teknis',
                mode: 'insensitive'
            }
        },
        select: { id: true }
    })

    const title = `Request Dismantle: ${mrCustomer.fullname} (${mrCustomer.username})`
    const description = `Permintaan pembongkaran perangkat (dismantle) untuk pelanggan MixRadius.\n\n` +
                        `Alasan: ${reason}\n` +
                        `Catatan: ${notes || '-'}\n\n` +
                        `Data MixRadius:\n` +
                        `- Member ID: ${mrCustomer.member_id}\n` +
                        `- Paket: ${mrCustomer.plan_name}\n` +
                        `- Alamat (Portal): ${mrCustomer.address}`

    const targetSiteId = requester?.siteId || localPelanggan?.siteId || undefined

    const workOrder = await workOrderRepo.create({
        type: 'DISCONNECTION',
        title: title,
        description: description,
        priority: 'NORMAL',
        contactName: mrCustomer.fullname,
        contactPhone: mrCustomer.phonenumber,
        locationAddress: mrCustomer.address,
        disconnectionReason: reason,
        createdById: user.id,
        ...(localPelanggan?.id ? { pelangganId: localPelanggan.id } : {}),
        ...(targetSiteId ? { siteId: targetSiteId } : {}),
        ...(department?.id ? { departmentId: department.id } : {}),
        ...(notes ? { internalNotes: notes } : {}),
    })

    const sopTasks = [
        "Konfirmasi jadwal kedatangan dengan pelanggan",
        "Pastikan perangkat (Modem/Router) dalam keadaan lengkap (Unit + Adaptor)",
        "Cek kondisi fisik perangkat (Baik/Rusak/Terbakar)",
        "Foto dokumentasi penarikan perangkat",
        "Foto dokumentasi lokasi/rumah pelanggan",
        "Update status inventory barang masuk",
        "Konfirmasi ke Admin untuk update data pelanggan"
    ]

    await prisma.workOrderTasks.createMany({
        data: sopTasks.map((taskTitle, index) => ({
            id: crypto.randomUUID(),
            workOrderId: workOrder.id,
            title: taskTitle,
            order: index,
            status: 'PENDING',
            updatedAt: new Date()
        }))
    })

    await onWorkOrderCreated({
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
    }, user.id).catch(err => console.error('[Dismantle] Notification error:', err))

    try {
        const { socketEmitter } = await import('@/lib/websocket/emitter')
        socketEmitter.newWorkOrder({
            id: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            status: workOrder.status,
            priority: workOrder.priority,
            createdAt: workOrder.createdAt.toISOString(),
            ...(workOrder.departmentId ? { departmentId: workOrder.departmentId } : {})
        }, workOrder.departmentId || undefined)
    } catch (e) {
        console.error('[Dismantle] Socket broadcast failed', e)
    }

    return apiSuccess({
        data: workOrder,
        message: `Work Order ${workOrder.workOrderNumber} berhasil dibuat.`
    }, { status: 201 })
})
