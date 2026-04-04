import { prisma } from '@/modules/database'
import { createHandler, apiSuccess } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = new URL(req.url)
    const siteId = searchParams.get('siteId')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (siteId) {
        where.siteId = siteId
    }

    const odps = await prisma.odp.findMany({
        where,
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            location: true,
        }
    })

    return apiSuccess({ odps })
})
