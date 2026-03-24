import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({
    auth: true,
    permissions: ['investors:read']
}, async (_req, ctx) => {
    const { id } = ctx.params

    const investor = await prisma.investor.findUnique({
        where: { id },
        include: {
            rabProjects: {
                include: {
                    rabProject: {
                        include: {
                            site: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            },
            payouts: {
                orderBy: { date: 'desc' },
                take: 5
            }
        }
    })

    if (!investor) {
        return ApiErrors.notFound('Investor')
    }

    // Sembunyikan field sensitif
    const { passwordHash: _, ...safeInvestor } = investor

    return apiSuccess(safeInvestor)
})
