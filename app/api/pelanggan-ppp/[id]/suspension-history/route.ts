import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * @swagger
 * /api/pelanggan-ppp/{id}/suspension-history:
 *   get:
 *     summary: Get customer suspension history
 *     description: |
 *       Retrieve complete suspension history for a customer with pagination support.
 *       Includes both active and historical suspension records.
 *     tags: [Customer Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer database ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: suspensionType
 *         schema:
 *           type: string
 *           enum: [PAYMENT, VIOLATION, MAINTENANCE, REQUEST]
 *         description: Filter by suspension type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: all
 *         description: Filter by suspension status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date (YYYY-MM-DD)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [suspendedAt, actualResumeAt, suspendedBy]
 *           default: suspendedAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Suspension history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     idPelanggan:
 *                       type: string
 *                     nama:
 *                       type: string
 *                     username:
 *                       type: string
 *                     status:
 *                       type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 filters:
 *                   type: object
 *                   properties:
 *                     suspensionType:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalSuspensions:
 *                       type: integer
 *                     activeSuspensions:
 *                       type: integer
 *                     averageSuspensionDuration:
 *                       type: number
 *                       description: Average duration in hours
 *                     mostCommonReason:
 *                       type: string
 *                       nullable: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       suspensionType:
 *                         type: string
 *                         enum: [PAYMENT, VIOLATION, MAINTENANCE, REQUEST]
 *                       reason:
 *                         type: string
 *                       suspendedAt:
 *                         type: string
 *                         format: date-time
 *                       suspendedBy:
 *                         type: string
 *                         nullable: true
 *                       expectedResumeAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       actualResumeAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       resumedBy:
 *                         type: string
 *                         nullable: true
 *                       notes:
 *                         type: string
 *                         nullable: true
 *                       isActive:
 *                         type: boolean
 *                       durationHours:
 *                         type: number
 *                         description: Duration in hours (null if still active)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
        // Check authentication
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
// Get customer information
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        status: true,
      },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const suspensionType = searchParams.get('suspensionType')
    const status = searchParams.get('status') || 'all'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy') || 'suspendedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Calculate date filters
    let startDate: Date | undefined
    let endDate: Date | undefined

    if (startDateParam) {
      startDate = new Date(startDateParam)
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format. Use YYYY-MM-DD format' },
          { status: 400 }
        )
      }
    }

    if (endDateParam) {
      endDate = new Date(endDateParam)
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format. Use YYYY-MM-DD format' },
          { status: 400 }
        )
      }
      // Set end of day for endDate
      endDate.setHours(23, 59, 59, 999)
    }

    // Build where clause
    const where: any = {
      pelangganId: id,
      ...(suspensionType && { suspensionType }),
      ...(startDate && {
        suspendedAt: { gte: startDate }
      }),
      ...(endDate && {
        suspendedAt: { lte: endDate }
      }),
    }

    // Filter by status
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }
    // 'all' status doesn't filter by isActive

    // Get total count for pagination
    const total = await (prisma as any).serviceSuspension.count({ where })

    // Get suspension records with pagination
    const suspensions = await (prisma as any).serviceSuspension.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        // Include user information for suspendedBy and resumedBy
        suspendedByuser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resumedByuser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Calculate statistics
    const allSuspensions = await (prisma as any).serviceSuspension.findMany({
      where: { pelangganId: id },
    })

    const activeSuspensions = await (prisma as any).serviceSuspension.count({
      where: { pelangganId: id, isActive: true }
    })

    // Calculate average suspension duration
    const completedSuspensions = allSuspensions.filter((s: any) => s.actualResumeAt && s.suspendedAt)
    const totalDurationHours = completedSuspensions.reduce((total: number, s: any) => {
      const duration = s.actualResumeAt!.getTime() - s.suspendedAt.getTime()
      return total + (duration / (1000 * 60 * 60)) // Convert to hours
    }, 0)
    const averageDurationHours = completedSuspensions.length > 0 ? totalDurationHours / completedSuspensions.length : 0

    // Find most common reason
    const reasonCounts = allSuspensions.reduce((acc: any, s: any) => {
      const reason = s.reason || 'Unknown'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const mostCommonReason = Object.keys(reasonCounts).length > 0
      ? Object.keys(reasonCounts).reduce((a: string, b: string) => reasonCounts[a] > reasonCounts[b] ? a : b)
      : null

    // Format suspension data
    const formattedSuspensions = suspensions.map((suspension: any) => {
      const durationHours = suspension.actualResumeAt && suspension.suspendedAt
        ? (suspension.actualResumeAt.getTime() - suspension.suspendedAt.getTime()) / (1000 * 60 * 60)
        : null

      return {
        id: suspension.id,
        suspensionType: suspension.suspensionType,
        reason: suspension.reason,
        suspendedAt: suspension.suspendedAt.toISOString(),
        suspendedBy: suspension.suspendedBy,
        suspendedByuser: suspension.suspendedByUser ? {
          id: suspension.suspendedByUser.id,
          name: suspension.suspendedByUser.name,
          email: suspension.suspendedByUser.email,
        } : null,
        expectedResumeAt: suspension.expectedResumeAt?.toISOString() || null,
        actualResumeAt: suspension.actualResumeAt?.toISOString() || null,
        resumedBy: suspension.resumedBy,
        resumedByuser: suspension.resumedByUser ? {
          id: suspension.resumedByUser.id,
          name: suspension.resumedByUser.name,
          email: suspension.resumedByUser.email,
        } : null,
        notes: suspension.notes,
        isActive: suspension.isActive,
        durationHours,
      }
    })

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      customer: pelanggan,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        suspensionType: suspensionType || null,
        status,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        sortBy,
        sortOrder,
      },
      statistics: {
        totalSuspensions: allSuspensions.length,
        activeSuspensions,
        averageSuspensionDuration: Math.round(averageDurationHours * 100) / 100, // Round to 2 decimal places
        mostCommonReason,
      },
      data: formattedSuspensions,
    })
  } catch (error: any) {
    console.error('Error fetching suspension history:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}