import { prisma } from '@/modules/database';
import { Prisma } from '@prisma/client';
import { prismaMitra } from '@/modules/database';
import { randomUUID } from 'crypto';
import { notifyAdminsAboutMobileAction } from '@/modules/notification';
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'

// GET - List available work orders (PENDING status, not assigned)
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const user = ctx.session!.user;
    const tenantId = user.tenantId as string;
    const userId = user.id;

    // Fetch user to get department, site(s) and name
    const dbUser = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: {
            departmentId: true,
            siteId: true,
            userSites: { select: { siteId: true } }
        }
    });

    const userSiteIds: string[] = [];
    if (dbUser?.userSites && dbUser.userSites.length > 0) {
        userSiteIds.push(...dbUser.userSites.map(us => us.siteId));
    } else if (dbUser?.siteId) {
        userSiteIds.push(dbUser.siteId);
    }

    let whereClause: Prisma.WorkOrdersWhereInput = {
        status: 'PENDING',
        assignedToId: null,
        assignedMitraId: null,
        tenantId,
        OR: [
            { isWarranty: false },
            {
                isWarranty: true,
                OR: [
                    { warrantySla: { lt: new Date() } },
                    { warrantyOwnerId: userId }
                ]
            }
        ]
    };

    if (user.role === 'MITRA') {
        const mitra = await prismaMitra.mitra.findUnique({
            where: { id: userId },
            select: { siteId: true }
        });
        const mitraSiteId = mitra?.siteId;

        whereClause = {
            ...whereClause,
            AND: [
                mitraSiteId
                    ? { OR: [{ siteId: null }, { siteId: mitraSiteId }] }
                    : { siteId: null }
            ]
        };
    } else {
        whereClause = {
            ...whereClause,
            AND: [
                dbUser?.departmentId
                    ? { OR: [{ departmentId: null }, { departmentId: dbUser.departmentId }] }
                    : { departmentId: null },
                userSiteIds.length > 0
                    ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
                    : { siteId: null }
            ]
        };
    }

    const workOrders = await prisma.workOrders.findMany({
        where: whereClause,
        select: {
            id: true,
            workOrderNumber: true,
            title: true,
            description: true,
            type: true,
            status: true,
            priority: true,
            contactName: true,
            contactPhone: true,
            locationAddress: true,
            scheduledDate: true,
            createdAt: true,
            pelanggan: { select: { id: true, nama: true, alamat: true, noTelp: true } },
            site: { select: { id: true, name: true, address: true } },
            department: { select: { id: true, name: true } }
        },
        orderBy: [{ priority: 'desc' }, { scheduledDate: 'asc' }, { createdAt: 'desc' }],
        take: 50
    });

    return apiSuccess(workOrders);
});

// POST - Take a work order (assign to self)
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const tenantId = user.tenantId as string;
    const userId = user.id;

    const body = await req.json();
    const { workOrderId } = body;

    if (!workOrderId) {
        return apiError('workOrderId wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const dbUser = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: {
            departmentId: true,
            siteId: true,
            name: true,
            userSites: { select: { siteId: true } }
        }
    });

    const userSiteIds: string[] = [];
    if (dbUser?.userSites && dbUser.userSites.length > 0) {
        userSiteIds.push(...dbUser.userSites.map(us => us.siteId));
    } else if (dbUser?.siteId) {
        userSiteIds.push(dbUser.siteId);
    }

    const workOrder = await prisma.workOrders.findFirst({
        where: { id: workOrderId, tenantId }
    });

    if (!workOrder) return ApiErrors.notFound('Work order tidak ditemukan');
    if (workOrder.status !== 'PENDING') return apiError('Work order sudah tidak tersedia', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    if (workOrder.assignedToId || workOrder.assignedMitraId) return apiError('Work order sudah diambil orang lain', ErrorCodes.VALIDATION_ERROR, { status: 400 });

    let updatedWorkOrder;
    let triggeredByName = dbUser?.name || user.name || 'Unknown';

    if (user.role === 'MITRA') {
        const mitra = await prismaMitra.mitra.findUnique({
            where: { id: userId },
            select: { name: true, siteId: true }
        });
        const mitraSiteId = mitra?.siteId;
        triggeredByName = mitra?.name || user.name || 'Unknown Mitra';

        if (workOrder.siteId && mitraSiteId !== workOrder.siteId) {
            return apiError('Anda tidak memiliki akses ke Work Order ini (Beda Site)', ErrorCodes.FORBIDDEN, { status: 403 });
        }

        updatedWorkOrder = await prisma.workOrders.update({
            where: { id: workOrderId, tenantId },
            data: {
                assignedMitraId: userId,
                status: 'ASSIGNED',
                scheduledDate: new Date(),
                scheduledTimeStart: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
            }
        });

        await prisma.workOrderAssignments.create({
            data: { id: randomUUID(), workOrderId, mitraId: userId, role: 'TEKNISI', status: 'PENDING' }
        });
    } else {
        const isDeptValid = !workOrder.departmentId || (dbUser?.departmentId && workOrder.departmentId === dbUser.departmentId);
        const isSiteValid = !workOrder.siteId || userSiteIds.includes(workOrder.siteId);

        if (!isDeptValid || !isSiteValid) {
            return ApiErrors.forbidden('Anda tidak memiliki akses ke Work Order ini (Beda Department/Site)');
        }

        updatedWorkOrder = await prisma.workOrders.update({
            where: { id: workOrderId, tenantId },
            data: {
                assignedToId: userId,
                status: 'ASSIGNED',
                scheduledDate: new Date(),
                scheduledTimeStart: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
            }
        });

        await prisma.workOrderAssignments.create({
            data: { id: randomUUID(), workOrderId, userId, role: 'TEKNISI', status: 'PENDING' }
        });
    }

    await prisma.workOrderUpdates.create({
        data: {
            id: randomUUID(),
            workOrderId,
            createdById: user.role === 'MITRA' ? null : userId,
            updateType: 'STATUS_CHANGE',
            message: user.role === 'MITRA' ? `Tiket diambil via Mobile App oleh Mitra Teknisi (${triggeredByName})` : 'Tiket diambil via Mobile App',
            oldStatus: 'PENDING',
            newStatus: 'ASSIGNED'
        }
    });

    await notifyAdminsAboutMobileAction({
        workOrderId,
        workOrderNumber: updatedWorkOrder.workOrderNumber,
        title: updatedWorkOrder.title,
        actionType: 'CLAIM',
        actionMessage: 'Mengambil/Claim tiket Work Order',
        triggeredByUserId: userId,
        triggeredByName: triggeredByName,
        ...(updatedWorkOrder.departmentId && { departmentId: updatedWorkOrder.departmentId }),
        ...(updatedWorkOrder.siteId && { siteId: updatedWorkOrder.siteId }),
    });

    return apiSuccess({ workOrder: updatedWorkOrder });
});
