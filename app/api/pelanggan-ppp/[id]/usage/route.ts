import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RadiusSyncService } from '@/modules/network'

/**
 * @swagger
 * /api/pelanggan-ppp/{id}/usage:
 *   get:
 *     summary: Get customer usage statistics
 *     description: |
 *       Retrieve comprehensive usage statistics for a customer including:
 *       - Current month usage from RADIUS accounting
 *       - Total usage statistics
 *       - Active session information
 *       - Usage trends
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
 *         name: period
 *         schema:
 *           type: string
 *           enum: [current_month, last_month, last_7_days, last_30_days, custom]
 *           default: current_month
 *         description: Period for usage statistics
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom end date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                 period:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                 usage:
 *                   type: object
 *                   properties:
 *                     totalSessions:
 *                       type: integer
 *                     totalSessionTime:
 *                       type: string
 *                       description: Session time in seconds
 *                     totalSessionTimeHours:
 *                       type: number
 *                       description: Session time in hours
 *                     totalInputOctets:
 *                       type: string
 *                       description: Upload bytes
 *                     totalOutputOctets:
 *                       type: string
 *                       description: Download bytes
 *                     totalInputGB:
 *                       type: number
 *                       description: Upload in GB
 *                     totalOutputGB:
 *                       type: number
 *                       description: Download in GB
 *                     totalGB:
 *                       type: number
 *                       description: Total usage in GB
 *                     activeSessions:
 *                       type: integer
 *                 activeSession:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     nasIpAddress:
 *                       type: string
 *                     callingStationId:
 *                       type: string
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
    const session = await getServerSession(authConfig)
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }
    // Get customer information
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id, tenantId: session.user.tenantId },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        status: true,
        tenantId: true,
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
    const period = searchParams.get('period') || 'current_month'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        break
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        break
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        endDate = now
        break
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        endDate = now
        break
      case 'custom':
        if (!startDateParam || !endDateParam) {
          return NextResponse.json(
            { error: 'Custom period requires startDate and endDate parameters' },
            { status: 400 }
          )
        }
        startDate = new Date(startDateParam)
        endDate = new Date(endDateParam)
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return NextResponse.json(
            { error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD' },
            { status: 400 }
          )
        }
        break
      default:
        return NextResponse.json(
          { error: 'Parameter periode tidak valid' },
          { status: 400 }
        )
    }

    // Get RADIUS usage statistics
    const radiusService = new RadiusSyncService(prisma)
    const radiusStats = await radiusService.getCustomerAccountingStats(
      pelanggan.username,
      pelanggan.tenantId!,
      startDate,
      endDate
    )

    // Get active sessions
    const activeSessions = await radiusService.getCustomerActiveSessions(pelanggan.username, pelanggan.tenantId!)
    const activeSession = activeSessions.length > 0 ? activeSessions[0] : null

    // Get customer usage from our database (for additional tracking)
    const customerUsage = await prisma.customerUsage.findMany({
      where: {
        pelangganId: id,
        session_start_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        session_start_time: 'desc',
      },
      take: 100, // Limit for performance
    })

    // Calculate additional statistics from our database
    const dbStats = customerUsage.reduce(
      (acc, usage) => {
        if (usage.session_duration) {
          acc.totalSessionTime += usage.session_duration
        }
        if (usage.upload_bytes) {
          acc.totalUploadBytes += usage.upload_bytes
        }
        if (usage.download_bytes) {
          acc.totalDownloadBytes += usage.download_bytes
        }
        if (usage.total_bytes) {
          acc.totalBytes += usage.total_bytes
        }
        return acc
      },
      {
        totalSessionTime: BigInt(0),
        totalUploadBytes: BigInt(0),
        totalDownloadBytes: BigInt(0),
        totalBytes: BigInt(0),
      }
    )

    // Combine RADIUS and database statistics
    const combinedStats = {
      // RADIUS stats (primary source)
      totalSessions: radiusStats.totalSessions,
      totalSessionTime: radiusStats.totalSessionTime,
      totalInputOctets: radiusStats.totalInputOctets,
      totalOutputOctets: radiusStats.totalOutputOctets,
      activeSessions: radiusStats.activeSessions,

      // Database stats (additional tracking)
      dbSessionCount: customerUsage.length,
      dbTotalSessionTime: dbStats.totalSessionTime,
      dbTotalUploadBytes: dbStats.totalUploadBytes,
      dbTotalDownloadBytes: dbStats.totalDownloadBytes,
      dbTotalBytes: dbStats.totalBytes,
    }

    // Convert BigInt to string and calculate human-readable values
    const usageStats = {
      ...combinedStats,
      totalSessionTime: combinedStats.totalSessionTime.toString(),
      totalInputOctets: combinedStats.totalInputOctets.toString(),
      totalOutputOctets: combinedStats.totalOutputOctets.toString(),
      dbTotalSessionTime: dbStats.totalSessionTime.toString(),
      dbTotalUploadBytes: dbStats.totalUploadBytes.toString(),
      dbTotalDownloadBytes: dbStats.totalDownloadBytes.toString(),
      dbTotalBytes: dbStats.totalBytes.toString(),

      // Human-readable formats
      totalSessionTimeHours: Number(combinedStats.totalSessionTime) / 3600,
      totalInputGB: Number(combinedStats.totalInputOctets) / 1073741824,
      totalOutputGB: Number(combinedStats.totalOutputOctets) / 1073741824,
      totalGB: (Number(combinedStats.totalInputOctets) + Number(combinedStats.totalOutputOctets)) / 1073741824,
      dbTotalSessionTimeHours: Number(dbStats.totalSessionTime) / 3600,
      dbTotalUploadGB: Number(dbStats.totalUploadBytes) / 1073741824,
      dbTotalDownloadGB: Number(dbStats.totalDownloadBytes) / 1073741824,
      dbTotalGB: Number(dbStats.totalBytes) / 1073741824,
    }

    return NextResponse.json({
      success: true,
      customer: pelanggan,
      period: {
        type: period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      usage: usageStats,
      activeSession: activeSession ? {
        sessionId: activeSession.acctSessionId,
        startTime: activeSession.acctStartTime?.toISOString(),
        nasIpAddress: activeSession.nasIpAddress,
      } : null,
    })
  } catch (error: unknown) {
    console.error('Error fetching customer usage:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}