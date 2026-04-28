import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig } from "@/lib/auth";
import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan";

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
const pelangganPppRouteService = new PelangganPppRouteService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authConfig)) as Session | null;
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const result = await pelangganPppRouteService.getUsageHistory({
      id,
      tenantId: session.user.tenantId,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      source: (searchParams.get("source") || "all") as Parameters<
        PelangganPppRouteService["getUsageHistory"]
      >[0]["source"],
      sortBy: (searchParams.get("sortBy") || "sessionStartTime") as Parameters<
        PelangganPppRouteService["getUsageHistory"]
      >[0]["sortBy"],
      sortOrder: (searchParams.get("sortOrder") || "desc") as Parameters<
        PelangganPppRouteService["getUsageHistory"]
      >[0]["sortOrder"],
    });

    if (!result) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("Error fetching customer usage history:", error);
    if (error instanceof RouteServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
      },
      { status: 500 },
    );
  }
}
