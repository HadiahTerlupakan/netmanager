import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { requireAuth } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/requests
 * List all Work Order Requests (status = REQUESTED)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        if (user instanceof NextResponse) {
            return user;
        }

        // Permission check
        if (!await hasPermission('workorders:requests:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || undefined;
        const departmentId = searchParams.get('departmentId') || undefined;
        const siteId = searchParams.get('siteId') || undefined;

        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        // Non-super admin restrictions
        const filters: { departmentId?: string; siteId?: string; search?: string } = { search };
        
        if (!isSuperAdmin) {
            // Site restriction
            if (user.permissions?.includes('workorders:site_only') && user.siteId) {
                filters.siteId = user.siteId;
            } else if (siteId) {
                filters.siteId = siteId;
            }
            
            // Department restriction  
            if (user.permissions?.includes('workorders:department_only') && user.departmentId) {
                filters.departmentId = user.departmentId;
            } else if (departmentId) {
                filters.departmentId = departmentId;
            }
        } else {
            if (siteId) filters.siteId = siteId;
            if (departmentId) filters.departmentId = departmentId;
        }

        const result = await workOrderRepo.findAllRequests(filters, page, limit);

        // Get count for badge
        const pendingCount = result.total;

        return NextResponse.json({
            success: true,
            data: result.workOrders,
            pagination: {
                page: result.page,
                totalPages: result.totalPages,
                total: result.total,
            },
            pendingCount,
        });
    } catch (error) {
        console.error('Error fetching work order requests:', error);
        return NextResponse.json(
            { error: 'Failed to fetch work order requests' },
            { status: 500 }
        );
    }
}
