import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan";

/**
 * @swagger
 * /api/pelanggan-ppp/{id}/suspend:
 *   post:
 *     summary: Suspend customer service
 *     description: |
 *       Suspend a customer's internet service with the following effects:
 *       - Changes customer status to NONAKTIF
 *       - Records suspension in ServiceSuspension model
 *       - Removes user from RADIUS authentication
 *       - Terminates active sessions
 *       - Creates audit trail
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - suspensionType
 *               - reason
 *             properties:
 *               suspensionType:
 *                 type: string
 *                 enum: [PAYMENT, VIOLATION, MAINTENANCE, REQUEST]
 *                 description: Type of suspension
 *                 example: "PAYMENT"
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Detailed reason for suspension
 *                 example: "Payment overdue for 30 days"
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Additional notes about suspension
 *                 example: "Customer contacted multiple times without response"
 *               expectedResumeAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expected date and time for service restoration
 *                 example: "2024-02-15T10:00:00Z"
 *               terminateActiveSessions:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to terminate active RADIUS sessions
 *                 example: true
 *     responses:
 *       200:
 *         description: Service suspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Customer service suspended successfully"
 *                 suspension:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     suspensionType:
 *                       type: string
 *                     reason:
 *                       type: string
 *                     suspendedAt:
 *                       type: string
 *                       format: date-time
 *                     expectedResumeAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
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
 *       400:
 *         description: Bad request - validation error or customer already suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id } = await params;
    const result = await pelangganPppRouteService.suspendCustomer({
      id,
      userId: (auth as { user: { id: string } }).user.id,
      body: await req.json(),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("Error suspending customer service:", error);
    if (error instanceof RouteServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status },
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
