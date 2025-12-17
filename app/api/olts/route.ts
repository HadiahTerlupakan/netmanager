import { NextResponse, NextRequest } from 'next/server'
import { requireAdmin, getCurrentSession } from '@/lib/auth-helpers'
import { getOLTRepository } from '@/lib/repositories'
import { oltCreateSchema } from '@/lib/validations/olt'

/**
 * @swagger
 * /api/olts:
 *   get:
 *     summary: Get all OLTs
 *     description: Mengambil daftar semua OLT (Optical Line Terminal). Hanya bisa diakses oleh ADMIN.
 *     tags: [OLTs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Daftar OLT berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 olts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OLT'
 *       401:
 *         description: Unauthorized - Tidak memiliki akses
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
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await requireAdmin(req)
    const oltRepository = getOLTRepository()
    const olts = await oltRepository.findAll()
    return NextResponse.json({ olts })
  } catch (error: any) {
    console.error('Error fetching OLTs:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data OLT', olts: [] },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/olts:
 *   post:
 *     summary: Create new OLT
 *     description: Membuat OLT baru. Hanya bisa diakses oleh ADMIN.
 *     tags: [OLTs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ipAddress
 *               - type
 *               - telnetPassword
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
 *                 default: 0
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
 *                 default: '0'
 *                 example: '0'
 *               telnetUsername:
 *                 type: string
 *                 default: zte
 *                 example: zte
 *               telnetPassword:
 *                 type: string
 *                 example: password123
 *               telnetPort:
 *                 type: integer
 *                 default: 23
 *                 example: 23
 *               snmpCommunityWrite:
 *                 type: string
 *                 default: public
 *                 example: public
 *               snmpVersion:
 *                 type: string
 *                 default: '2'
 *                 example: '2'
 *               snmpPort:
 *                 type: integer
 *                 default: 161
 *                 example: 161
 *     responses:
 *       200:
 *         description: OLT berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: clx1234567890
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Tidak memiliki akses
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
export async function POST(req: NextRequest) {
  // Cek autentikasi admin menggunakan fungsi terpusat
  const session = await requireAdmin(req)

  const json = await req.json()
  const parsed = oltCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const oltRepository = getOLTRepository()
    const olt = await oltRepository.create({
      name: data.name,
      ipAddress: data.ipAddress,
      type: data.type,
      version: data.version ?? null,
      temperature: data.temperature ?? null,
      connectedDevices: data.connectedDevices ?? 0,
      model: data.model ?? null,
      uptime: data.uptime ?? null,
      syncStatus: data.syncStatus ?? '0',
      syncDate: data.syncDate ? new Date(data.syncDate) : null,
      telnetConnected: data.telnetConnected ?? false,
      snmpConnected: data.snmpConnected ?? false,
      snmpCommunityWrite: data.snmpCommunityWrite ?? 'public',
      snmpVersion: data.snmpVersion ?? '2',
      snmpPort: data.snmpPort ?? 161,
      telnetUsername: data.telnetUsername ?? 'zte',
      telnetPassword: data.telnetPassword,
      telnetPort: data.telnetPort ?? 23,
    })


    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'OLT',
        userId: session.user.id,
        details: { id: olt.id, name: data.name, ip: data.ipAddress }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ id: olt.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}

