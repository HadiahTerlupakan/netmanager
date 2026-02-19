import { prisma } from '@/lib/prisma';
import { getWorkOrderService, type UserContext } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';
import { createNotification } from '@/modules/notification';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

// POST /api/admin/workorders/[id]/assign - Assign work order
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const userBase = ctx.session!.user;
    const { id } = ctx.params;

    if (!await hasPermission('list:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk assign work order');
    }

    // Fetch extended user context
    const dbUser = await prisma.user.findUnique({
        where: { id: userBase.id },
        select: { id: true, departmentId: true, siteId: true }
    });
    if (!dbUser) return ApiErrors.unauthorized();

    const userContext: UserContext = {
        id: userBase.id,
        role: userBase.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();

    // Get WO for access control check
    const getResult = await workOrderService.getWorkOrderById(id, userContext);
    if (!getResult.success) {
        return ApiErrors.notFound('Work Order');
    }
    const existingWO = getResult.data!;

    // Access Control
    const isSuper = isSuperAdmin(userBase);
    if (userContext.permissions?.includes('workorders:site_only') && !isSuper) {
        if (existingWO.siteId !== userContext.siteId) {
            return ApiErrors.forbidden('Anda hanya dapat mengakses work order di site Anda');
        }
    }
    if (userContext.permissions?.includes('workorders:department_only') && !isSuper) {
        if (existingWO.departmentId !== userContext.departmentId) {
            return ApiErrors.forbidden('Anda hanya dapat mengakses work order di departemen Anda');
        }
    }

    const body = await req.json();

    if (!body.employeeId) {
        return apiError('Employee ID wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    // Use service for assignment
    const result = await workOrderService.assignWorkOrder(id, body.employeeId, userContext, body.role);

    if (!result.success) {
        return apiError(result.error || 'Gagal assign work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    const workOrder = result.data!;

    // Additional: Direct notification to assigned technician (endpoint-specific)
    const employee = await prisma.user.findUnique({
        where: { id: body.employeeId },
        select: { id: true, name: true, pushToken: true, isActive: true }
    });

    if (employee) {
        try {
            // In-app notification
            await createNotification({
                type: 'WORK_ORDER',
                priority: (workOrder.priority === 'CRITICAL' ? 'URGENT' : workOrder.priority) as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
                title: '📋 Work Order Di-assign ke Anda',
                message: `${workOrder.workOrderNumber}: ${workOrder.title}`,
                link: `/admin/workorders/${workOrder.id}`,
                userId: employee.id,
                siteId: workOrder.siteId || undefined,
                sourceType: 'WORK_ORDER',
                sourceId: workOrder.id,
            });

            // Push notification to mobile
            if (employee.pushToken && employee.isActive) {
                await sendPushToUsers(
                    [employee.id],
                    '📋 Work Order Baru',
                    `${workOrder.workOrderNumber}: ${workOrder.title}`,
                    { workOrderId: workOrder.id, type: 'WORK_ORDER', screen: 'WorkOrderDetail' }
                );
            }
        } catch (notifyError) {
            console.error('Additional notification failed:', notifyError);
        }
    }

    return apiSuccess(workOrder, { message: 'Work order berhasil di-assign' });
})
