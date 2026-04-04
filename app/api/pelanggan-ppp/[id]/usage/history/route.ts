import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/modules/database'
import { RadiusSyncService } from '@/modules/network'
import { Prisma } from '@prisma/client'
import { toEndOfDay } from '@/lib/utils/server-datetime'


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
    const session = await getServerSession(authConfig) as Session | null
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
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
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const source = searchParams.get('source') || 'all'
    const sortBy = searchParams.get('sortBy') || 'sessionStartTime'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Parameter paginasi tidak valid' },
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
          { error: 'Format startDate tidak valid. Gunakan format YYYY-MM-DD' },
          { status: 400 }
        )
      }
    }

    if (endDateParam) {
      endDate = new Date(endDateParam)
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Format endDate tidak valid. Gunakan format YYYY-MM-DD' },
          { status: 400 }
        )
      }
      // Set end of day for endDate
      endDate.setTime(toEndOfDay(endDate).getTime())
    }

    // Prepare data arrays
    let radiusSessions: Record<string, unknown>[] = []
    let customerUsage: Prisma.CustomerUsageGetPayload<object>[] = []

    // Get RADIUS session data if needed
    if (source === 'all' || source === 'radius') {
      const radiusService = new RadiusSyncService()
      // Access the private radiusRepo through a type assertion
      const radiusRepo = (radiusService as unknown as { radiusRepo: { getUserSessions: (u: string, s?: Date, e?: Date) => Promise<Record<string, unknown>[]> } }).radiusRepo
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
      const prismaSortBy = {
        sessionStartTime: 'session_start_time',
        sessionDuration: 'session_duration',
        totalBytes: 'total_bytes'
      }[sortBy] || 'session_start_time'

      customerUsage = await prisma.customerUsage.findMany({
        where: {
          pelangganId: id,
          ...(startDate && {
            session_start_time: { gte: startDate }
          }),
          ...(endDate && {
            session_start_time: { lte: endDate }
          }),
        },
        orderBy: {
          [prismaSortBy]: sortOrder,
        },
      })
    }

    // Combine and format data
    const combinedData = []

    // Add RADIUS sessions
    for (const session of radiusSessions) {
      const inputOctets = BigInt(String(session.acctInputOctets || 0));
      const outputOctets = BigInt(String(session.acctOutputOctets || 0));
      const totalBytes = inputOctets + outputOctets;

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
      const totalBytes = (usage.upload_bytes || BigInt(0)) + (usage.download_bytes || BigInt(0))
      combinedData.push({
        id: usage.id,
        sessionId: usage.session_id,
        sessionStartTime: usage.session_start_time,
        sessionEndTime: usage.session_end_time,
        sessionDuration: usage.session_duration?.toString() || '0',
        sessionDurationMinutes: usage.session_duration ? Number(usage.session_duration) / 60 : 0,
        uploadBytes: usage.upload_bytes?.toString() || '0',
        downloadBytes: usage.download_bytes?.toString() || '0',
        totalBytes: usage.total_bytes?.toString() || '0',
        uploadGB: usage.upload_bytes ? Number(usage.upload_bytes) / 1073741824 : 0,
        downloadGB: usage.download_bytes ? Number(usage.download_bytes) / 1073741824 : 0,
        totalGB: Number(totalBytes) / 1073741824,
        nasIpAddress: usage.nas_ip_address,
        callingStationId: usage.calling_station_id,
        calledStationId: usage.called_station_id,
        terminateCause: usage.terminate_cause,
        source: 'database',
      })
    }

    // Sort combined data
    type CombinedDataItem = typeof combinedData[number];
    combinedData.sort((a: CombinedDataItem, b: CombinedDataItem) => {
      let aValue: string | number | Date | null | undefined = a[sortBy as keyof CombinedDataItem] as string | number | Date | null | undefined
      let bValue: string | number | Date | null | undefined = b[sortBy as keyof CombinedDataItem] as string | number | Date | null | undefined

      // Handle string dates
      if (typeof aValue === 'string' && !isNaN(Date.parse(aValue))) {
        aValue = new Date(aValue)
      }
      if (typeof bValue === 'string' && !isNaN(Date.parse(bValue))) {
        bValue = new Date(bValue)
      }

      if (sortOrder === 'asc') {
        return (aValue ?? 0) > (bValue ?? 0) ? 1 : -1
      } else {
        return (aValue ?? 0) < (bValue ?? 0) ? 1 : -1
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
  } catch (error: unknown) {
    console.error('Error fetching customer usage history:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
