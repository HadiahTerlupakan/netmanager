import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getOLTRepository } from '@/lib/repositories'
import { oltUpdateSchema } from '@/lib/validations/olt'

/**
 * @swagger
 * /api/olts/{id}:
 *   get:
 *     summary: Get OLT by ID
 *     description: Mengambil detail OLT berdasarkan ID. Hanya bisa diakses oleh ADMIN.
 *     tags: [OLTs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: OLT ID
 *     responses:
 *       200:
 *         description: Detail OLT berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 olt:
 *                   $ref: '#/components/schemas/OLT'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: OLT tidak ditemukan
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)
  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }
  return NextResponse.json({ olt })
}

/**
 * @swagger
 * /api/olts/{id}:
 *   patch:
 *     summary: Update OLT
 *     description: Mengupdate data OLT. Hanya bisa diakses oleh ADMIN.
 *     tags: [OLTs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: OLT ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: OLT-Jakarta-01
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 example: 192.168.1.100
 *               type:
 *                 type: string
 *                 example: ZTE-C300
 *               version:
 *                 type: string
 *                 nullable: true
 *                 example: 1.0.0
 *               temperature:
 *                 type: integer
 *                 nullable: true
 *                 example: 45
 *               connectedDevices:
 *                 type: integer
 *                 example: 128
 *               model:
 *                 type: string
 *                 nullable: true
 *                 example: C300
 *               uptime:
 *                 type: string
 *                 nullable: true
 *                 example: 30 days
 *               syncStatus:
 *                 type: string
 *                 example: '0'
 *               syncDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               telnetConnected:
 *                 type: boolean
 *               snmpConnected:
 *                 type: boolean
 *               snmpCommunityWrite:
 *                 type: string
 *                 example: public
 *               snmpVersion:
 *                 type: string
 *                 example: '2'
 *               snmpPort:
 *                 type: integer
 *                 example: 161
 *               telnetUsername:
 *                 type: string
 *                 example: zte
 *               telnetPassword:
 *                 type: string
 *                 example: password123
 *               telnetPort:
 *                 type: integer
 *                 example: 23
 *     responses:
 *       200:
 *         description: OLT berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: OLT tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: IP Address sudah terpakai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const body = await _req.json()
  const parsed = oltUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const oltRepository = getOLTRepository()
  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.ipAddress !== undefined) data.ipAddress = parsed.data.ipAddress
  if (parsed.data.type !== undefined) data.type = parsed.data.type
  if (parsed.data.version !== undefined) data.version = parsed.data.version
  if (parsed.data.temperature !== undefined) data.temperature = parsed.data.temperature
  if (parsed.data.connectedDevices !== undefined) data.connectedDevices = parsed.data.connectedDevices
  if (parsed.data.model !== undefined) data.model = parsed.data.model
  if (parsed.data.uptime !== undefined) data.uptime = parsed.data.uptime
  if (parsed.data.syncStatus !== undefined) data.syncStatus = parsed.data.syncStatus
  if (parsed.data.syncDate !== undefined) data.syncDate = parsed.data.syncDate ? new Date(parsed.data.syncDate) : null
  if (parsed.data.telnetConnected !== undefined) data.telnetConnected = parsed.data.telnetConnected
  if (parsed.data.snmpConnected !== undefined) data.snmpConnected = parsed.data.snmpConnected
  if (parsed.data.snmpCommunityWrite !== undefined) data.snmpCommunityWrite = parsed.data.snmpCommunityWrite
  if (parsed.data.snmpVersion !== undefined) data.snmpVersion = parsed.data.snmpVersion
  if (parsed.data.snmpPort !== undefined) data.snmpPort = parsed.data.snmpPort
  if (parsed.data.telnetUsername !== undefined) data.telnetUsername = parsed.data.telnetUsername
  if (parsed.data.telnetPassword !== undefined) data.telnetPassword = parsed.data.telnetPassword
  if (parsed.data.telnetPort !== undefined) data.telnetPort = parsed.data.telnetPort

  try {
    await oltRepository.update(id, data)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'OLT',
        userId: session.user.id,
        details: { id, changes: parsed.data }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}

/**
 * @swagger
 * /api/olts/{id}:
 *   delete:
 *     summary: Delete OLT
 *     description: Menghapus OLT. Hanya bisa diakses oleh ADMIN.
 *     tags: [OLTs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: OLT ID
 *     responses:
 *       200:
 *         description: OLT berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: OLT tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const oltRepository = getOLTRepository()
  await oltRepository.delete(id)

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'DELETE',
      subject: 'OLT',
      userId: session.user.id,
      details: { id }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ ok: true })
}
