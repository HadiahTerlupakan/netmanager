import { NextResponse, NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/modules/database'
import { LogType, Prisma } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'
import { checkSiteRestriction } from '@/modules/roles'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
    try {
        const session = await requireAdmin(req)
        if (session instanceof NextResponse) return session

        // Permission check
        if (!await hasPermission('system_log:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat system log')
        }

        const { searchParams } = new URL(req.url)
        const typeKey = searchParams.get('type')
        const action = searchParams.get('action')
        const search = searchParams.get('search')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const skip = (page - 1) * limit

        const where: Prisma.SystemLogWhereInput = {}

        if (search) {
            where.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { action: { contains: search, mode: 'insensitive' } },
                { details: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } }
            ]
        }

        if (typeKey && Object.values(LogType).includes(typeKey as LogType)) {
            where.type = typeKey as LogType
        }

        if (action) {
            where.action = action
        }

        const siteIdParam = searchParams.get('siteId')
        if (siteIdParam) {
            where.user = {
                siteId: siteIdParam
            }
        }

        // SITE RESTRICTION LOGIC
        const { isRestricted, siteIds } = checkSiteRestriction(session, 'system_log')

        if (isRestricted) {
            if (siteIds.length === 0) {
                // Restricted user but no siteId? Treat as no access to logs.
                return apiSuccess({
                    logs: [],
                    pagination: { total: 0, page, limit, totalPages: 0 }
                })
            }
            // Filter logs where the *actor* (user) is from the same site
            where.user = {
                siteId: { in: siteIds }
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

        return apiSuccess({
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
        return ApiErrors.internalError('Gagal mengambil system log')
    }
}
