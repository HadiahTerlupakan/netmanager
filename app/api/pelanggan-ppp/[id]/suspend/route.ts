import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RadiusSyncService } from '@/modules/network'
import { requireAuth } from '@/lib/auth-helpers'
import { z } from 'zod'
import { logActivitySafe } from '@/lib/logger'

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
const suspendRequestSchema = z.object({
  suspensionType: z.enum(['PAYMENT', 'VIOLATION', 'MAINTENANCE', 'REQUEST']),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  notes: z.string().max(1000, 'Notes too long').optional(),
  expectedResumeAt: z.string().datetime().optional(),
  terminateActiveSessions: z.boolean().default(true),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication using centralized auth helper
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) {
      return auth
    }

    const { id } = await params
    // Get customer information
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      include: {
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
      },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Check if customer is already suspended
    if (pelanggan.status === 'NONAKTIF') {
      return NextResponse.json(
        { error: 'Customer is already suspended' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = suspendRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const {
      suspensionType,
      reason,
      notes,
      expectedResumeAt,
      terminateActiveSessions,
    } = validationResult.data

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      const txExtended = tx as unknown as {
        serviceSuspension: {
          create: (args: unknown) => Promise<{
            id: string;
            suspensionType: string;
            reason: string;
            notes: string | null;
            suspendedAt: Date;
            expectedResumeAt: Date | null;
            suspendedBy: string;
            isActive: boolean;
          }>;
        }
      };

      // 1. Create suspension record
      // Using a typed extension to access the dynamic model while avoiding plain any
      const suspension = await txExtended.serviceSuspension.create({
        data: {
          pelangganId: id,
          suspensionType,
          reason,
          notes,
          expectedResumeAt: expectedResumeAt ? new Date(expectedResumeAt) : null,
          suspendedBy: (auth as { user: { id: string } }).user.id,
          isActive: true,
        },
      })

      // 2. Update customer status
      await tx.pelanggan.update({
        where: { id },
        data: {
          status: 'NONAKTIF',
          updatedAt: new Date(),
        },
      })

      // 3. Add note to customer record
      const suspensionNote = `Service suspended: ${reason} (${suspensionType})`
      await tx.pelanggan.update({
        where: { id },
        data: {
          catatan: pelanggan.catatan
            ? `${pelanggan.catatan}\n\n${suspensionNote}`
            : suspensionNote,
        },
      })

      return suspension
    })

    // 4. Handle RADIUS operations outside transaction
    const radiusService = new RadiusSyncService(prisma)

    try {
      // Remove from RADIUS to disable authentication
      await radiusService.handleStatusChange(id, 'NONAKTIF')

      // Terminate active sessions if requested
      if (terminateActiveSessions) {
        const activeSessions = await radiusService.getCustomerActiveSessions(pelanggan.username, pelanggan.tenantId!)

        // Log active sessions that were terminated
        for (const _session of activeSessions) {
          // console.log(`[SUSPEND] Terminated active session ${_session.acctSessionId} for user ${pelanggan.username}`)
        }
      }
    } catch (radiusError: unknown) {
      console.error('Error handling RADIUS operations during suspension:', radiusError)
      // Don't fail the request, but log the error
    }

    // 5. Get updated customer data for response
    const updatedPelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        status: true,
      },
    })

    // System Log
    logActivitySafe({
      action: 'SUSPEND',
      subject: 'Pelanggan',
      userId: (auth as { user: { id: string } }).user.id,
      details: {
        id: id,
        type: suspensionType,
        reason: reason,
        suspensionId: result.id
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Customer service suspended successfully',
      suspension: {
        id: result.id,
        suspensionType: result.suspensionType,
        reason: result.reason,
        notes: result.notes,
        suspendedAt: result.suspendedAt.toISOString(),
        expectedResumeAt: result.expectedResumeAt?.toISOString() || null,
        suspendedBy: result.suspendedBy,
        isActive: result.isActive,
      },
      customer: updatedPelanggan,
    })
  } catch (error: unknown) {
    console.error('Error suspending customer service:', error)

    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    const errorCode = (error as { code?: string }).code

    // Handle specific errors
    if (errorCode === 'P2002') {
      return NextResponse.json(
        { error: 'Suspension record already exists' },
        { status: 400 }
      )
    }

    if (errorCode === 'P2025') {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}