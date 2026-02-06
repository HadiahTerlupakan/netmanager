import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkOrderService } from '@/modules/work-order';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';
import { createNotification } from '@/modules/notification';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

// POST /api/admin/workorders/[id]/assign - Assign work order
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('list:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk assign work order');
        }

        const { id } = await params;
        const workOrderService = getWorkOrderService();

        // Get WO for access control check
        const getResult = await workOrderService.getWorkOrderById(id, user as any);
        if (!getResult.success) {
            return ApiErrors.notFound('Work Order');
        }
        const existingWO = getResult.data!;

        // Access Control
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
            if (existingWO.siteId !== user.siteId) {
                return ApiErrors.forbidden('Anda hanya dapat mengakses work order di site Anda');
            }
        }
        if (user.permissions?.includes('workorders:department_only') && !isSuperAdmin) {
            if (existingWO.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Anda hanya dapat mengakses work order di departemen Anda');
            }
        }

        const body = await request.json();

        if (!body.employeeId) {
            return apiError('Employee ID wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        // Use service for assignment (handles core logic, logging, cache, basic notification)
        const result = await workOrderService.assignWorkOrder(id, body.employeeId, user as any, body.role);

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
    } catch (error) {
        console.error('Error assigning work order:', error);
        return ApiErrors.internalError('Gagal assign work order');
    }
}
