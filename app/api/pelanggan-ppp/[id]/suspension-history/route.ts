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
    const result = await pelangganPppRouteService.getSuspensionHistory({
      id,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      suspensionType: searchParams.get("suspensionType"),
      status: (searchParams.get("status") || "all") as Parameters<
        PelangganPppRouteService["getSuspensionHistory"]
      >[0]["status"],
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      sortBy: (searchParams.get("sortBy") || "suspendedAt") as Parameters<
        PelangganPppRouteService["getSuspensionHistory"]
      >[0]["sortBy"],
      sortOrder: (searchParams.get("sortOrder") || "desc") as Parameters<
        PelangganPppRouteService["getSuspensionHistory"]
      >[0]["sortOrder"],
    });

    if (!result) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error fetching suspension history:", error);
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
