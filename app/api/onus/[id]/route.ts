import { NextRequest, NextResponse } from 'next/server'
import { getOnuRepository } from '@/lib/repositories'
import { requireAuth } from '@/lib/auth-helpers'

/**
 * @swagger
 * /api/onus/{id}:
 *   get:
 *     summary: Get ONU by ID
 *     description: Mengambil detail ONU berdasarkan ID
 *     tags: [ONUs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ONU ID
 *     responses:
 *       200:
 *         description: Detail ONU berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 onu:
 *                   $ref: '#/components/schemas/ONU'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: ONU tidak ditemukan
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
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check using centralized auth helper
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) {
      return auth
    }

    const { id } = await params
    const onuRepo = getOnuRepository()
    
    const onu = await onuRepo.findByGponOnu('', id) // We'll search by gponOnu instead of ID
      .catch(() => null)

    if (!onu) {
      return NextResponse.json({ error: 'ONU tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ onu })
  } catch (error: any) {
    console.error('Error fetching ONU:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/onus/{id}:
 *   put:
 *     summary: Update ONU by ID
 *     description: Mengupdate data ONU berdasarkan ID
 *     tags: [ONUs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ONU ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ONU-Customer-001"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "ONU for customer"
 *               pppoe:
 *                 type: string
 *                 nullable: true
 *                 example: "customer001"
 *               status:
 *                 type: string
 *                 example: "Online"
 *               rxOlt:
 *                 type: string
 *                 nullable: true
 *                 example: "-15.5"
 *               rxOnu:
 *                 type: string
 *                 nullable: true
 *                 example: "-5.2"
 *               txOlt:
 *                 type: string
 *                 nullable: true
 *                 example: "2.1"
 *               txOnu:
 *                 type: string
 *                 nullable: true
 *                 example: "0.5"
 *               serialNumber:
 *                 type: string
 *                 nullable: true
 *                 example: "ZTEGC1234567"
 *               actualType:
 *                 type: string
 *                 nullable: true
 *                 example: "ZXHN F670L"
 *               distance:
 *                 type: number
 *                 nullable: true
 *                 example: 1500
 *               lastSeen:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               registrationMode:
 *                 type: string
 *                 nullable: true
 *                 example: "auto"
 *               softwareVersion:
 *                 type: string
 *                 nullable: true
 *                 example: "V3.0.0"
 *               hardwareVersion:
 *                 type: string
 *                 nullable: true
 *                 example: "V2.0"
 *               temperature:
 *                 type: number
 *                 nullable: true
 *                 example: 45
 *               laserBiasCurrent:
 *                 type: number
 *                 nullable: true
 *                 example: 12.5
 *               vendorId:
 *                 type: string
 *                 nullable: true
 *                 example: "ZTE"
 *               equipmentId:
 *                 type: string
 *                 nullable: true
 *                 example: "F670L"
 *               firmwareVersion:
 *                 type: string
 *                 nullable: true
 *                 example: "V3.0.0"
 *               macAddress:
 *                 type: string
 *                 nullable: true
 *                 example: "00:11:22:33:44:55"
 *               batteryStatus:
 *                 type: string
 *                 nullable: true
 *                 example: "OK"
 *               opticalTransceiverType:
 *                 type: string
 *                 nullable: true
 *                 example: "Class B+"
 *               lastDeregTime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               authMode:
 *                 type: string
 *                 nullable: true
 *                 example: "LOID"
 *               loid:
 *                 type: string
 *                 nullable: true
 *                 example: "12345678"
 *               password:
 *                 type: string
 *                 nullable: true
 *                 example: "password123"
 *               configState:
 *                 type: string
 *                 nullable: true
 *                 example: "Configured"
 *               powerLevel:
 *                 type: string
 *                 nullable: true
 *                 example: "Normal"
 *               dyingGaspTime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               rxPowerStatus:
 *                 type: string
 *                 nullable: true
 *                 example: "Normal"
 *               txPowerStatus:
 *                 type: string
 *                 nullable: true
 *                 example: "Normal"
 *               rxBytes:
 *                 type: number
 *                 nullable: true
 *                 example: 1048576
 *               txBytes:
 *                 type: number
 *                 nullable: true
 *                 example: 524288
 *               rxPackets:
 *                 type: number
 *                 nullable: true
 *                 example: 1024
 *               txPackets:
 *                 type: number
 *                 nullable: true
 *                 example: 512
 *               rxErrors:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *               txErrors:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *               rxDrops:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *               txDrops:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *               wifiEnable:
 *                 type: boolean
 *                 nullable: true
 *                 example: true
 *               wifiSsid:
 *                 type: string
 *                 nullable: true
 *                 example: "MyWiFi"
 *               wifiSecurityMode:
 *                 type: string
 *                 nullable: true
 *                 example: "WPA2-PSK"
 *               wifiChannel:
 *                 type: integer
 *                 nullable: true
 *                 example: 6
 *     responses:
 *       200:
 *         description: ONU berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 onu:
 *                   $ref: '#/components/schemas/ONU'
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
 *         description: ONU tidak ditemukan
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
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check using centralized auth helper
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) {
      return auth
    }

    const { id } = await params
    const body = await req.json()
    
    // First check if ONU exists
    const onuRepo = getOnuRepository()
    const existingOnu = await onuRepo.findByGponOnu('', id)
      .catch(() => null)

    if (!existingOnu) {
      return NextResponse.json({ error: 'ONU tidak ditemukan' }, { status: 404 })
    }

    // Parse date fields if they exist
    const updateData: any = {}
    
    // Handle all possible fields from the schema
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.pppoe !== undefined) updateData.pppoe = body.pppoe
    if (body.status !== undefined) updateData.status = body.status
    if (body.rxOlt !== undefined) updateData.rxOlt = body.rxOlt
    if (body.rxOnu !== undefined) updateData.rxOnu = body.rxOnu
    if (body.txOlt !== undefined) updateData.txOlt = body.txOlt
    if (body.txOnu !== undefined) updateData.txOnu = body.txOnu
    if (body.serialNumber !== undefined) updateData.serialNumber = body.serialNumber
    if (body.actualType !== undefined) updateData.actualType = body.actualType
    if (body.distance !== undefined) updateData.distance = body.distance
    if (body.lastSeen !== undefined) updateData.lastSeen = body.lastSeen ? new Date(body.lastSeen) : null
    if (body.registrationMode !== undefined) updateData.registrationMode = body.registrationMode
    if (body.softwareVersion !== undefined) updateData.softwareVersion = body.softwareVersion
    if (body.hardwareVersion !== undefined) updateData.hardwareVersion = body.hardwareVersion
    if (body.temperature !== undefined) updateData.temperature = body.temperature
    if (body.laserBiasCurrent !== undefined) updateData.laserBiasCurrent = body.laserBiasCurrent
    if (body.vendorId !== undefined) updateData.vendorId = body.vendorId
    if (body.equipmentId !== undefined) updateData.equipmentId = body.equipmentId
    if (body.firmwareVersion !== undefined) updateData.firmwareVersion = body.firmwareVersion
    if (body.macAddress !== undefined) updateData.macAddress = body.macAddress
    if (body.batteryStatus !== undefined) updateData.batteryStatus = body.batteryStatus
    if (body.opticalTransceiverType !== undefined) updateData.opticalTransceiverType = body.opticalTransceiverType
    if (body.lastDeregTime !== undefined) updateData.lastDeregTime = body.lastDeregTime ? new Date(body.lastDeregTime) : null
    if (body.authMode !== undefined) updateData.authMode = body.authMode
    if (body.loid !== undefined) updateData.loid = body.loid
    if (body.password !== undefined) updateData.password = body.password
    if (body.configState !== undefined) updateData.configState = body.configState
    if (body.powerLevel !== undefined) updateData.powerLevel = body.powerLevel
    if (body.dyingGaspTime !== undefined) updateData.dyingGaspTime = body.dyingGaspTime ? new Date(body.dyingGaspTime) : null
    if (body.rxPowerStatus !== undefined) updateData.rxPowerStatus = body.rxPowerStatus
    if (body.txPowerStatus !== undefined) updateData.txPowerStatus = body.txPowerStatus
    if (body.rxBytes !== undefined) updateData.rxBytes = body.rxBytes ? BigInt(body.rxBytes) : null
    if (body.txBytes !== undefined) updateData.txBytes = body.txBytes ? BigInt(body.txBytes) : null
    if (body.rxPackets !== undefined) updateData.rxPackets = body.rxPackets ? BigInt(body.rxPackets) : null
    if (body.txPackets !== undefined) updateData.txPackets = body.txPackets ? BigInt(body.txPackets) : null
    if (body.rxErrors !== undefined) updateData.rxErrors = body.rxErrors ? BigInt(body.rxErrors) : null
    if (body.txErrors !== undefined) updateData.txErrors = body.txErrors ? BigInt(body.txErrors) : null
    if (body.rxDrops !== undefined) updateData.rxDrops = body.rxDrops ? BigInt(body.rxDrops) : null
    if (body.txDrops !== undefined) updateData.txDrops = body.txDrops ? BigInt(body.txDrops) : null
    if (body.wifiEnable !== undefined) updateData.wifiEnable = body.wifiEnable
    if (body.wifiSsid !== undefined) updateData.wifiSsid = body.wifiSsid
    if (body.wifiSecurityMode !== undefined) updateData.wifiSecurityMode = body.wifiSecurityMode
    if (body.wifiChannel !== undefined) updateData.wifiChannel = body.wifiChannel
    if (body.lastUpdate !== undefined) updateData.lastUpdate = body.lastUpdate ? new Date(body.lastUpdate) : new Date()

    // Update the ONU
    await onuRepo.update(existingOnu.id, updateData)

    // Get the updated ONU
    const updatedOnu = await onuRepo.findByGponOnu('', id)
      .catch(() => null)

    return NextResponse.json({ onu: updatedOnu })
  } catch (error: any) {
    console.error('Error updating ONU:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/onus/{id}:
 *   delete:
 *     summary: Delete ONU by ID
 *     description: Menghapus ONU berdasarkan ID
 *     tags: [ONUs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ONU ID
 *     responses:
 *       200:
 *         description: ONU berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ONU berhasil dihapus"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: ONU tidak ditemukan
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
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check using centralized auth helper
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) {
      return auth
    }

    const { id } = await params
    const onuRepo = getOnuRepository()
    
    // First check if ONU exists
    const existingOnu = await onuRepo.findByGponOnu('', id)
      .catch(() => null)

    if (!existingOnu) {
      return NextResponse.json({ error: 'ONU tidak ditemukan' }, { status: 404 })
    }

    // Delete the ONU
    await onuRepo.delete(existingOnu.id)

    return NextResponse.json({ message: 'ONU berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting ONU:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}