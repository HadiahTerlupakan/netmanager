import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { configurationRestoreCreateSchema } from '@/lib/validations/device-backup'
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
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const json = await req.json()
    const parsed = configurationRestoreCreateSchema.safeParse(json)
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    
    // Verify backup exists
    try {
      // @ts-ignore - Will work after schema update
      const backup = await prisma.deviceBackup.findUnique({
        where: { id },
      })

      if (!backup) {
        return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
      }

      // @ts-ignore - Will work after schema update
      const result = await prisma.configurationRestore.create({
        data: {
          deviceId: data.deviceId,
          deviceType: data.deviceType,
          backupId: id,
          restoreName: data.restoreName,
          description: data.description,
          restoreMethod: data.restoreMethod,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          rollbackEnabled: data.rollbackEnabled || false,
          createdBy: session.user?.id,
        },
      })

      return NextResponse.json({ id: result.id }, { status: 201 })
    } catch (prismaError: any) {
      // Handle case where model doesn't exist yet
      if (prismaError.code === 'P2021') {
        return NextResponse.json(
          { error: 'Configuration restore will be available after database migration' },
          { status: 503 }
        )
      }
      throw prismaError
    }
  } catch (error: any) {
    console.error('Error creating configuration restore:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal membuat restore konfigurasi' },
      { status: 500 }
    )
  }
}