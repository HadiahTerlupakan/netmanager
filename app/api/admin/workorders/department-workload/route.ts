import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/department-workload
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('work_order_dashboard:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat beban kerja departemen');
    }

    let departmentIdFilter: string | undefined = undefined;

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Enforce Department Restriction
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const isSuper = isSuperAdmin(user);

    if (hasDepartmentRestriction && !isSuper) {
        if (!dbUser.departmentId) {
            return apiSuccess([], { message: "Restricted access: No department assigned." });
        }
        departmentIdFilter = dbUser.departmentId;
    }

    const workload = await workOrderRepo.getDepartmentWorkload(departmentIdFilter);

    return apiSuccess(workload);
})
