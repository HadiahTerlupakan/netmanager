import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { buildSessionWithPermissions, createHandler } from "@/lib/api";
import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan";

/**
 * @swagger
 * /api/pelanggan-ppp/{id}/activate:
 *   post:
 *     summary: Activate suspended customer service
 *     description: |
 *       Reactivate a suspended customer's internet service with the following effects:
 *       - Changes customer status back to AKTIF
 *       - Updates suspension record with actual resume time
 *       - Restores user in RADIUS authentication
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Notes about service activation
 *                 example: "Payment confirmed, service restored"
 *               activationMethod:
 *                 type: string
 *                 enum: [MANUAL, AUTOMATIC, PAYMENT_CONFIRMED]
 *                 description: Method of activation
 *                 example: "PAYMENT_CONFIRMED"
 *               syncToRadius:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to immediately sync to RADIUS
 *                 example: true
 *     responses:
 *       200:
 *         description: Service activated successfully
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
 *                   example: "Customer service activated successfully"
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
 *                     actualResumeAt:
 *                       type: string
 *                       format: date-time
 *                     resumedBy:
 *                       type: string
 *                     isActive:
 *                       type: boolean
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
 *         description: Bad request - customer not suspended or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Missing pelanggan:update, or customer in a site the caller cannot access
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

export const POST = createHandler(
  { auth: true, permissions: ["pelanggan:update"] },
  async (req, ctx) => {
    try {
      const session = buildSessionWithPermissions(
        ctx.session!,
        ctx.permissions,
      );
      const body = await req.json().catch(() => ({}));
      const result = await pelangganPppRouteService.activateCustomer({
        id: ctx.params.id,
        userId: session.user.id,
        body,
        session,
      });

      return NextResponse.json(result);
    } catch (error: unknown) {
      logger.error("Error activating customer service:", error);
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
  },
);
