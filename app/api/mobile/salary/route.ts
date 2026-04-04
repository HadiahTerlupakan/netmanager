import { prisma } from '@/modules/database'
import { apiSuccess, createHandler } from '@/lib/api'

export const GET = createHandler({ 
    auth: true,
    permissions: ['m_salary:read']
}, async (_req, ctx) => {
    const userSession = ctx.session!.user;
    const userId = userSession.id;
    const tenantId = userSession.tenantId as string;

    const salaries = await prisma.salary.findMany({
        where: {
            userId: userId,
            status: 'PAID',
            tenantId 
        },
        select: {
            id: true,
            month: true,
            year: true,
            status: true,
            netSalary: true,
            paidAt: true
        },
        orderBy: [
            { year: 'desc' },
            { month: 'desc' }
        ]
    });

    return apiSuccess(salaries.map(s => ({
        id: s.id,
        period: `${new Date(s.year, s.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
        netSalary: s.netSalary,
        paidAt: s.paidAt,
        month: s.month,
        year: s.year
    })));
});
