import { NextResponse, NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { LogType } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'

export async function GET(req: NextRequest) {
    try {
        const session = await requireAdmin(req)
        if (session instanceof NextResponse) return session

        // Permission check
        if (!await hasPermission('system_log:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const typeKey = searchParams.get('type')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const skip = (page - 1) * limit

        const where: any = {}
        if (typeKey && Object.values(LogType).includes(typeKey as LogType)) {
            where.type = typeKey as LogType
        }

        const siteIdParam = searchParams.get('siteId')
        if (siteIdParam) {
            where.user = {
                siteId: siteIdParam
            }
        }

        // SITE RESTRICTION LOGIC
        const user = session.user as any
        const isSuperAdmin = user.role === 'SUPER_ADMIN'
        const isSiteRestricted = await hasPermission('system_log:site_only') && !isSuperAdmin

        if (isSiteRestricted) {
            if (!user.siteId) {
                // Restricted user but no siteId? Treat as no access to logs.
                 return NextResponse.json({
                    logs: [],
                    pagination: { total: 0, page, limit, totalPages: 0 }
                })
            }
            // Filter logs where the *actor* (user) is from the same site
            where.user = {
                siteId: user.siteId
            }
        }

        const [total, logs] = await Promise.all([
            prisma.systemLog.count({ where }),
            prisma.systemLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
                include: {
                    user: {
                        select: { name: true, email: true }
                    }
                }
            })
        ])

        return NextResponse.json({
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error('Error fetching system logs:', error)
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }
}
