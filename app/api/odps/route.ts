import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { createHandler, apiSuccess } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const siteId = searchParams.get('siteId')

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
