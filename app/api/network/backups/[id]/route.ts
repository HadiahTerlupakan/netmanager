import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/network/backups/{id}:
 *   get:
 *     summary: Get device backup by ID
 *     description: Mengambil data backup perangkat berdasarkan ID
 *     tags: [Device Backups]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup ID
 *     responses:
 *       200:
 *         description: Device backup retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceBackup'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Backup not found
 *       500:
 *         description: Server error
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const { id } = await params

    try {
      const backup = await prisma.deviceBackups.findUnique({
        where: { id },
      })

      if (!backup) {
        return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
      }

      return NextResponse.json({ data: backup })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return NextResponse.json(
          { error: 'Device backups will be available after database migration' },
          { status: 503 }
        )
      }
      throw prismaError
    }
  } catch (error: unknown) {
    console.error('Error fetching device backup:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memuat data backup perangkat' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/network/backups/{id}:
 *   delete:
 *     summary: Delete device backup
 *     description: Menghapus data backup perangkat
 *     tags: [Device Backups]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup ID
 *     responses:
 *       200:
 *         description: Device backup deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Backup not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const { id } = await params

    try {
      const backup = await prisma.deviceBackups.findUnique({
        where: { id },
      })

      if (!backup) {
        return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
      }

      await prisma.deviceBackups.delete({
        where: { id },
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'DELETE',
          subject: 'Device Backup',
          userId: (session as { user: { id: string } }).user.id,
          details: { id, name: backup.backupName }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return NextResponse.json({ message: 'Backup berhasil dihapus' })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return NextResponse.json(
          { error: 'Device backups will be available after database migration' },
          { status: 503 }
        )
      }
      throw prismaError
    }
  } catch (error: unknown) {
    console.error('Error deleting device backup:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghapus backup perangkat' },
      { status: 500 }
    )
  }
}