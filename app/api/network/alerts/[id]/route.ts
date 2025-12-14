import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { networkAlertUpdateSchema } from '@/lib/validations/network-performance'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/network/alerts/{id}:
 *   get:
 *     summary: Get network alert by ID
 *     description: Mengambil data alert jaringan berdasarkan ID
 *     tags: [Network Alerts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Network alert retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkAlert'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
      const alert = await prisma.networkAlert.findUnique({
        where: { id },
      })

      if (!alert) {
        return NextResponse.json({ error: 'Alert tidak ditemukan' }, { status: 404 })
      }

      return NextResponse.json({ data: alert })
    } catch (prismaError: any) {
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error fetching network alert:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data alert jaringan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/network/alerts/{id}:
 *   put:
 *     summary: Update network alert
 *     description: Memperbarui data alert jaringan
 *     tags: [Network Alerts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Alert title
 *               message:
 *                 type: string
 *                 description: Alert message
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, WARNING, INFO]
 *                 description: Alert severity
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ACKNOWLEDGED, RESOLVED, SUPPRESSED]
 *                 description: Alert status
 *               acknowledged:
 *                 type: boolean
 *                 description: Whether alert is acknowledged
 *               resolved:
 *                 type: boolean
 *                 description: Whether alert is resolved
 *               autoResolve:
 *                 type: boolean
 *                 description: Whether alert should auto-resolve
 *               autoResolveTime:
 *                 type: integer
 *                 minimum: 1
 *                 description: Auto-resolve time in minutes
 *     responses:
 *       200:
 *         description: Network alert updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const json = await req.json()
    const parsed = networkAlertUpdateSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    try {
      const updateData: any = { ...data }

      if (data.acknowledged) {
        updateData.acknowledgedBy = session.user?.id
        updateData.acknowledgedAt = new Date()
      }

      if (data.resolved) {
        updateData.resolvedBy = session.user?.id
        updateData.resolvedAt = new Date()
      }

      if (data.severity) updateData.severity = data.severity as any
      if (data.status) updateData.status = data.status as any

      await prisma.networkAlert.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({ message: 'Alert berhasil diperbarui' })
    } catch (prismaError: any) {
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error updating network alert:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui alert jaringan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/network/alerts/{id}:
 *   delete:
 *     summary: Delete network alert
 *     description: Menghapus data alert jaringan
 *     tags: [Network Alerts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Network alert deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
      const alert = await prisma.networkAlert.findUnique({
        where: { id },
      })

      if (!alert) {
        return NextResponse.json({ error: 'Alert tidak ditemukan' }, { status: 404 })
      }

      await prisma.networkAlert.delete({
        where: { id },
      })

      return NextResponse.json({ message: 'Alert berhasil dihapus' })
    } catch (prismaError: any) {
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error deleting network alert:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus alert jaringan' },
      { status: 500 }
    )
  }
}