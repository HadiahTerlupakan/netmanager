import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RadiusSyncService } from '@/modules/network'
import { requireAuth } from '@/lib/auth-helpers'
import { z } from 'zod'

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
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
const activateRequestSchema = z.object({
  notes: z.string().max(1000, 'Notes too long').optional(),
  activationMethod: z.enum(['MANUAL', 'AUTOMATIC', 'PAYMENT_CONFIRMED']).optional(),
  syncToRadius: z.boolean().default(true),
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

    // Check if customer is currently suspended
    if (pelanggan.status !== 'NONAKTIF') {
      return NextResponse.json(
        { error: 'Customer is not currently suspended' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await req.json().catch(() => ({}))
    const validationResult = activateRequestSchema.safeParse(body)

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
      notes,
      activationMethod = 'MANUAL',
      syncToRadius,
    } = validationResult.data

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find and update active suspension record
      const activeSuspension = await (tx as any).serviceSuspension.findFirst({
        where: {
          pelangganId: id,
          isActive: true,
        },
        orderBy: {
          suspendedAt: 'desc',
        },
      })

      if (!activeSuspension) {
        throw new Error('No active suspension found for this customer')
      }

      // 2. Update suspension record
      const updatedSuspension = await (tx as any).serviceSuspension.update({
        where: { id: activeSuspension.id },
        data: {
          actualResumeAt: new Date(),
          resumedBy: (auth as any)?.user?.id,
          isActive: false,
          notes: notes ? `${activeSuspension.notes || ''}\n\nActivation: ${notes}` : activeSuspension.notes,
        },
      })

      // 3. Update customer status
      await tx.pelanggan.update({
        where: { id },
        data: {
          status: 'AKTIF',
          updatedAt: new Date(),
        },
      })

      // 4. Add activation note to customer record
      const activationNote = `Service reactivated: ${activationMethod}${notes ? ` - ${notes}` : ''}`
      await tx.pelanggan.update({
        where: { id },
        data: {
          catatan: pelanggan.catatan
            ? `${pelanggan.catatan}\n\n${activationNote}`
            : activationNote,
        },
      })

      return updatedSuspension
    })

    // 5. Handle RADIUS operations outside transaction
    const radiusService = new RadiusSyncService(prisma)

    if (syncToRadius) {
      try {
        // Restore user in RADIUS to enable authentication
        await radiusService.handleStatusChange(id, 'AKTIF')

        console.log(`[ACTIVATE] Restored RADIUS access for user ${pelanggan.username}`)
      } catch (radiusError) {
        console.error('Error handling RADIUS operations during activation:', radiusError)
        // Don't fail the request, but log the error
      }
    }

    // 6. Get updated customer data for response
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

    return NextResponse.json({
      success: true,
      message: 'Customer service activated successfully',
      suspension: {
        id: result.id,
        suspensionType: result.suspensionType,
        reason: result.reason,
        suspendedAt: result.suspendedAt.toISOString(),
        actualResumeAt: result.actualResumeAt.toISOString(),
        resumedBy: result.resumedBy,
        isActive: result.isActive,
        notes: result.notes,
      },
      customer: updatedPelanggan,
    })
  } catch (error: any) {
    console.error('Error activating customer service:', error)

    // Handle specific errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (error.message === 'No active suspension found for this customer') {
      return NextResponse.json(
        { error: 'No active suspension found for this customer' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}