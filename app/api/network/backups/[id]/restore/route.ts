import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { configurationRestoreCreateSchema } from '@/lib/validations/device-backup'
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
 * /api/network/backups/{id}/restore:
 *   post:
 *     summary: Restore configuration from backup
 *     description: Memulih konfigurasi dari backup
 *     tags: [Configuration Restore]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - deviceType
 *               - backupId
 *               - restoreName
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Device ID
 *               deviceType:
 *                 type: string
 *                 enum: [OLT, MIKROTIK, ONU]
 *                 description: Device type
 *               backupId:
 *                 type: string
 *                 description: Backup ID to restore from
 *               restoreName:
 *                 type: string
 *                 description: Restore name
 *               description:
 *                 type: string
 *                 description: Restore description
 *               restoreMethod:
 *                 type: string
 *                 description: Restore method (SNMP, API, SSH, TELNET)
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled restore time
 *               rollbackEnabled:
 *                 type: boolean
 *                 default: false
 *                 description: Whether rollback is enabled
 *     responses:
 *       201:
 *         description: Configuration restore initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Backup not found
 *       500:
 *         description: Server error
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

    const { id } = await params
    const json = await req.json()
    const parsed = configurationRestoreCreateSchema.safeParse(json)
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    
    // Verify backup exists
    try {
      const backup = await prisma.deviceBackups.findUnique({
          where: { id },
      })

      if (!backup) {
          return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
      }

      const result = await prisma.configurationRestores.create({
        data: {
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          backupId: id,
          restoreName: data.restoreName,
          description: data.description,
          restoreMethod: data.restoreMethod,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          rollbackEnabled: data.rollbackEnabled || false,
          createdBy: (session as { user?: { id?: string } }).user?.id,
        } as unknown as Prisma.ConfigurationRestoresCreateInput,
      })

      return NextResponse.json({ id: result.id }, { status: 201 })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return NextResponse.json(
          { error: 'Pemulihan konfigurasi akan tersedia setelah migrasi database' },
          { status: 503 }
        )
      }
      throw prismaError
    }
  } catch (error: unknown) {
    console.error('Error creating configuration restore:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat restore konfigurasi' },
      { status: 500 }
    )
  }
}