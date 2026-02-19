import { prisma } from '@/lib/prisma'
import { apiSuccess, createHandler } from '@/lib/api'

// GET /api/admin/options - Get dropdown options
export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    // No permission check required - all authenticated users need access to options
    const [sites, departments] = await Promise.all([
        prisma.sites.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.departments.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ])

    return apiSuccess({ sites, departments })
})
