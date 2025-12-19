import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')
        const userId = searchParams.get('userId')
        const siteId = searchParams.get('siteId')
        const departmentId = searchParams.get('departmentId')

        const where: any = {}

        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDateStr)
            end.setHours(23, 59, 59, 999)

            where.checkIn = { gte: start, lte: end }
        } else if (startDateStr) {
            const start = new Date(startDateStr)
            start.setHours(0, 0, 0, 0)
            const end = new Date(startDateStr)
            end.setHours(23, 59, 59, 999)

            where.checkIn = { gte: start, lte: end }
        }

        // Apply filters to User relation
        if (userId || siteId || departmentId) {
            where.user = {
                ...(userId && { id: userId }),
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            }
        }

        const [attendances, total, statusSummary] = await Promise.all([
            prisma.attendance.findMany({
                where,
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                            image: true,
                            department: { select: { name: true } },
                            site: { select: { name: true } }
                        }
                    }
                },
                orderBy: { checkIn: 'desc' },
                take: limit,
                skip
            }),
            prisma.attendance.count({ where }),
            prisma.attendance.groupBy({
                by: ['status'],
                where,
                _count: {
                    _all: true
                }
            })
        ])

        // Format summary
        const summary = statusSummary.reduce((acc, curr) => {
            acc[curr.status] = curr._count._all
            return acc
        }, {} as Record<string, number>)

        return NextResponse.json({
            success: true,
            data: attendances,
            summary,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })

    } catch (error: any) {
        console.error('Error fetching admin attendance:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
