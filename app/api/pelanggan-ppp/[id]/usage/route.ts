import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan";

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
const pelangganPppRouteService = new PelangganPppRouteService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const result = await pelangganPppRouteService.getUsageSummary({
      id,
      tenantId: session.user.tenantId,
      period: (searchParams.get("period") || "current_month") as Parameters<
        PelangganPppRouteService["getUsageSummary"]
      >[0]["period"],
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error fetching customer usage:", error);
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
