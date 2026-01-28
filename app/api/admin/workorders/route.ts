import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository, getWorkOrderService } from '@/modules/work-order';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * @swagger
 * /api/admin/workorders:
 *   get:
 *     summary: Get all work orders
 *     description: Mengambil daftar semua work order dengan filter dan pagination
 *     tags: [Work Orders]
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
        if (!await hasPermission('list:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat work order');
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const type = searchParams.get('type');
        const departmentId = searchParams.get('departmentId');
        const siteId = searchParams.get('siteId');
        const assignedToId = searchParams.get('assignedToId');
        const search = searchParams.get('search');
        const unassignedOnly = searchParams.get('unassignedOnly') === 'true';
        const woType = searchParams.get('woType'); // 'customer' | 'internal'

        // Build filters
        const filters: any = {};
        if (status) filters.status = status.includes(',') ? status.split(',') : status;
        if (priority) filters.priority = priority.includes(',') ? priority.split(',') : priority;
        if (type) filters.type = type.includes(',') ? type.split(',') : type;
        if (unassignedOnly) filters.unassignedOnly = true;
        if (departmentId) filters.departmentId = departmentId;
        if (siteId) filters.siteId = siteId;
        if (search) filters.search = search;
        if (assignedToId) filters.assignedToId = assignedToId;
        
        // Filter by WO Type (Customer vs Internal)
        if (woType === 'customer') {
            filters.isInternal = false;
        } else if (woType === 'internal') {
            filters.isInternal = true;
        }

        // Use WorkOrderService with user context for permission-based filtering
        const workOrderService = getWorkOrderService();
        const result = await workOrderService.getWorkOrders({
            page,
            limit,
            filters,
            userId: user.id,
            userPermissions: user.permissions || [],
            userDepartmentId: user.departmentId,
            userSiteId: user.siteId,
            userRole: user.role,
        });

        if (!result.success) {
            return apiError(result.error || 'Gagal mengambil work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        return apiSuccess(result.data);
    } catch (error) {
        console.error('Error fetching work orders:', error);
        return ApiErrors.internalError('Gagal mengambil work order');
    }
}

/**
 * @swagger
 * /api/admin/workorders:
 *   post:
 *     summary: Create new work order
 *     description: Membuat work order baru dan mengirim notifikasi ke department terkait
 *     tags: [Work Orders]
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
        if (!await hasPermission('list:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat work order');
        }

        const body = await request.json();

        // Use WorkOrderService for creation (handles validation, notifications, socket, logging, cache)
        const workOrderService = getWorkOrderService();
        const result = await workOrderService.createWorkOrder(body, user.id);

        if (!result.success) {
            if (result.code === 'VALIDATION_ERROR') {
                return apiError(result.error || 'Data tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
            }
            return apiError(result.error || 'Gagal membuat work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        return apiSuccess(result.data, { status: 201, message: 'Work order berhasil dibuat' });
    } catch (error) {
        console.error('Error creating work order:', error);
        return ApiErrors.internalError('Gagal membuat work order');
    }
}
