import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RadiusSyncService } from '@/lib/services/radius-sync-service'

/**
 * @swagger
 * /api/pelanggan-ppp/{id}/usage/history:
 *   get:
 *     summary: Get customer usage history
 *     description: |
 *       Retrieve detailed usage history for a customer with pagination support.
 *       Combines data from RADIUS accounting and customer usage tracking.
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
 *         name: source
 *         schema:
 *           type: string
 *           enum: [all, radius, database]
 *           default: all
 *         description: Data source filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [sessionStartTime, sessionDuration, totalBytes]
 *           default: sessionStartTime
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
 *         description: Usage history retrieved successfully
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
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     source:
 *                       type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       sessionId:
 *                         type: string
 *                       sessionStartTime:
 *                         type: string
 *                         format: date-time
 *                       sessionEndTime:
 *                         type: string
 *                         format: date-time
 *                       sessionDuration:
 *                         type: string
 *                         description: Duration in seconds
 *                       sessionDurationMinutes:
 *                         type: number
 *                         description: Duration in minutes
 *                       uploadBytes:
 *                         type: string
 *                       downloadBytes:
 *                         type: string
 *                       totalBytes:
 *                         type: string
 *                       uploadGB:
 *                         type: number
 *                       downloadGB:
 *                         type: number
 *                       totalGB:
 *                         type: number
 *                       nasIpAddress:
 *                         type: string
 *                       callingStationId:
 *                         type: string
 *                       calledStationId:
 *                         type: string
 *                       terminateCause:
 *                         type: string
 *                       source:
 *                         type: string
 *                         enum: [radius, database]
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

        const { id } = await params
    const { provider } = await params
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
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const source = searchParams.get('source') || 'all'
    const sortBy = searchParams.get('sortBy') || 'sessionStartTime'
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

    // Prepare data arrays
    let radiusSessions: any[] = []
    let customerUsage: any[] = []

    // Get RADIUS session data if needed
    if (source === 'all' || source === 'radius') {
      const radiusService = new RadiusSyncService(prisma)
      // Access the private radiusRepo through a type assertion
      const radiusRepo = (radiusService as any).radiusRepo
      if (radiusRepo && typeof radiusRepo.getUserSessions === 'function') {
        radiusSessions = await radiusRepo.getUserSessions(
          pelanggan.username,
          startDate,
          endDate
        )
      }
    }

    // Get customer usage data if needed
    if (source === 'all' || source === 'database') {
      customerUsage = await prisma.customerUsage.findMany({
        where: {
          pelangganId: id,
          ...(startDate && {
            sessionStartTime: { gte: startDate }
          }),
          ...(endDate && {
            sessionStartTime: { lte: endDate }
          }),
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
      })
    }

    // Combine and format data
    const combinedData = []

    // Add RADIUS sessions
    for (const session of radiusSessions) {
      const totalBytes = (session.acctInputOctets || BigInt(0)) + (session.acctOutputOctets || BigInt(0))
      combinedData.push({
        id: `radius-${session.radAcctId}`,
        sessionId: session.acctSessionId,
        sessionStartTime: session.acctStartTime,
        sessionEndTime: session.acctStopTime,
        sessionDuration: session.acctSessionTime?.toString() || '0',
        sessionDurationMinutes: session.acctSessionTime ? Number(session.acctSessionTime) / 60 : 0,
        uploadBytes: session.acctInputOctets?.toString() || '0',
        downloadBytes: session.acctOutputOctets?.toString() || '0',
        totalBytes: totalBytes.toString(),
        uploadGB: session.acctInputOctets ? Number(session.acctInputOctets) / 1073741824 : 0,
        downloadGB: session.acctOutputOctets ? Number(session.acctOutputOctets) / 1073741824 : 0,
        totalGB: Number(totalBytes) / 1073741824,
        nasIpAddress: session.nasIpAddress,
        callingStationId: session.callingStationId,
        calledStationId: session.calledStationId,
        terminateCause: session.acctTerminateCause,
        source: 'radius',
      })
    }

    // Add customer usage records
    for (const usage of customerUsage) {
      const totalBytes = (usage.uploadBytes || BigInt(0)) + (usage.downloadBytes || BigInt(0))
      combinedData.push({
        id: usage.id,
        sessionId: usage.sessionId,
        sessionStartTime: usage.sessionStartTime,
        sessionEndTime: usage.sessionEndTime,
        sessionDuration: usage.sessionDuration?.toString() || '0',
        sessionDurationMinutes: usage.sessionDuration ? Number(usage.sessionDuration) / 60 : 0,
        uploadBytes: usage.uploadBytes?.toString() || '0',
        downloadBytes: usage.downloadBytes?.toString() || '0',
        totalBytes: usage.totalBytes?.toString() || '0',
        uploadGB: usage.uploadBytes ? Number(usage.uploadBytes) / 1073741824 : 0,
        downloadGB: usage.downloadBytes ? Number(usage.downloadBytes) / 1073741824 : 0,
        totalGB: Number(totalBytes) / 1073741824,
        nasIpAddress: usage.nasIpAddress,
        callingStationId: usage.callingStationId,
        calledStationId: usage.calledStationId,
        terminateCause: usage.terminateCause,
        source: 'database',
      })
    }

    // Sort combined data
    combinedData.sort((a: any, b: any) => {
      let aValue: any = a[sortBy]
      let bValue: any = b[sortBy]

      // Handle string dates
      if (typeof aValue === 'string' && !isNaN(Date.parse(aValue))) {
        aValue = new Date(aValue)
      }
      if (typeof bValue === 'string' && !isNaN(Date.parse(bValue))) {
        bValue = new Date(bValue)
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    // Calculate pagination
    const total = combinedData.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = combinedData.slice(startIndex, endIndex)

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
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        source,
      },
      data: paginatedData,
    })
  } catch (error: any) {
    console.error('Error fetching customer usage history:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}