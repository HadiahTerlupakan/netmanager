import { NextRequest, NextResponse } from 'next/server'
import { getOnuRepository } from '@/lib/repositories'
import { onuCreateSchema } from '@/lib/validations/onu'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * @swagger
 * /api/onus:
 *   post:
 *     summary: Create new ONU
 *     description: Membuat ONU baru
 *     tags: [ONUs]
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
 *               - oltId
 *               - name
 *               - gponOnu
 *               - status
 *             properties:
 *               oltId:
 *                 type: string
 *                 example: "clt123456789"
 *                 description: OLT ID
 *               name:
 *                 type: string
 *                 example: "ONU-Customer-001"
 *                 description: Nama ONU
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "ONU for customer"
 *                 description: Deskripsi ONU
 *               pppoe:
 *                 type: string
 *                 nullable: true
 *                 example: "customer001"
 *                 description: Username PPPoE
 *               gponOnu:
 *                 type: string
 *                 example: "1/1/1:1"
 *                 description: GPON ONU identifier format
 *               status:
 *                 type: string
 *                 example: "Online"
 *                 description: Status ONU
 *               rxOlt:
 *                 type: string
 *                 nullable: true
 *                 example: "-15.5"
 *                 description: Signal level di OLT in dBm
 *               rxOnu:
 *                 type: string
 *                 nullable: true
 *                 example: "-5.2"
 *                 description: Signal level di ONU in dBm
 *               txOlt:
 *                 type: string
 *                 nullable: true
 *                 example: "2.1"
 *                 description: Transmit power di OLT in dBm
 *               txOnu:
 *                 type: string
 *                 nullable: true
 *                 example: "0.5"
 *                 description: Transmit power di ONU in dBm
 *               serialNumber:
 *                 type: string
 *                 nullable: true
 *                 example: "ZTEGC1234567"
 *                 description: Nomor serial ONU
 *               actualType:
 *                 type: string
 *                 nullable: true
 *                 example: "ZXHN F670L"
 *                 description: Tipe ONU aktual
 *               registerTime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Waktu registrasi
 *               distance:
 *                 type: number
 *                 nullable: true
 *                 example: 1500
 *                 description: Jarak ke OLT in meter
 *               lastSeen:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Terakhir kali terlihat
 *               registrationMode:
 *                 type: string
 *                 nullable: true
 *                 example: "auto"
 *                 description: Mode registrasi
 *               softwareVersion:
 *                 type: string
 *                 nullable: true
 *                 example: "V3.0.0"
 *                 description: Versi software
 *               hardwareVersion:
 *                 type: string
 *                 nullable: true
 *                 example: "V2.0"
 *                 description: Versi hardware
 *               temperature:
 *                 type: number
 *                 nullable: true
 *                 example: 45
 *                 description: Suhu ONU in Celsius
 *               laserBiasCurrent:
 *                 type: number
 *                 nullable: true
 *                 example: 12.5
 *                 description: Laser bias current in mA
 *               vendorId:
 *                 type: string
 *                 nullable: true
 *                 example: "ZTE"
 *                 description: ID vendor
 *               equipmentId:
 *                 type: string
 *                 nullable: true
 *                 example: "F670L"
 *                 description: ID peralatan
 *               firmwareVersion:
 *                 type: string
 *                 nullable: true
 *                 example: "V3.0.0"
 *                 description: Versi firmware
 *               macAddress:
 *                 type: string
 *                 nullable: true
 *                 example: "00:11:22:33:44:55"
 *                 description: MAC address
 *               batteryStatus:
 *                 type: string
 *                 nullable: true
 *                 example: "OK"
 *                 description: Status baterai
 *               opticalTransceiverType:
 *                 type: string
 *                 nullable: true
 *                 example: "Class B+"
 *                 description: Tipe optical transceiver
 *               lastDeregTime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Waktu deregistrasi terakhir
 *               authMode:
 *                 type: string
 *                 nullable: true
 *                 example: "LOID"
 *                 description: Mode autentikasi
 *               loid:
 *                 type: string
 *                 nullable: true
 *                 example: "12345678"
 *                 description: Logical ONU ID
 *               password:
 *                 type: string
 *                 nullable: true
 *                 example: "password123"
 *                 description: Password ONU
 *               configState:
 *                 type: string
 *                 nullable: true
 *                 example: "Configured"
 *                 description: Status konfigurasi
 *               powerLevel:
 *                 type: string
 *                 nullable: true
 *                 example: "Normal"
 *                 description: Level daya
 *               dyingGaspTime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Waktu dying gasp
 *               rxPowerStatus:
 *                 type: string
 *                 nullable: true
 *                 example: "Normal"
 *                 description: Status daya terima
 *               txPowerStatus:
 *                 type: string
 *                 nullable: true
 *                 example: "Normal"
 *                 description: Status daya kirim
 *               rxBytes:
 *                 type: number
 *                 nullable: true
 *                 example: 1048576
 *                 description: Bytes diterima
 *               txBytes:
 *                 type: number
 *                 nullable: true
 *                 example: 524288
 *                 description: Bytes dikirim
 *               rxPackets:
 *                 type: number
 *                 nullable: true
 *                 example: 1024
 *                 description: Paket diterima
 *               txPackets:
 *                 type: number
 *                 nullable: true
 *                 example: 512
 *                 description: Paket dikirim
 *               rxErrors:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *                 description: Error diterima
 *               txErrors:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *                 description: Error dikirim
 *               rxDrops:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *                 description: Paket di-drop diterima
 *               txDrops:
 *                 type: number
 *                 nullable: true
 *                 example: 0
 *                 description: Paket di-drop dikirim
 *               wifiEnable:
 *                 type: boolean
 *                 nullable: true
 *                 example: true
 *                 description: WiFi enable
 *               wifiSsid:
 *                 type: string
 *                 nullable: true
 *                 example: "MyWiFi"
 *                 description: WiFi SSID
 *               wifiSecurityMode:
 *                 type: string
 *                 nullable: true
 *                 example: "WPA2-PSK"
 *                 description: Mode keamanan WiFi
 *               wifiChannel:
 *                 type: integer
 *                 nullable: true
 *                 example: 6
 *                 description: Channel WiFi
 *               statusOid:
 *                 type: string
 *                 nullable: true
 *                 description: SNMP OID untuk status
 *               rxOltOid:
 *                 type: string
 *                 nullable: true
 *                 description: SNMP OID untuk RX OLT
 *               rxOnuOid:
 *                 type: string
 *                 nullable: true
 *                 description: SNMP OID untuk RX ONU
 *               nameOid:
 *                 type: string
 *                 nullable: true
 *                 description: SNMP OID untuk nama
 *               descOid:
 *                 type: string
 *                 nullable: true
 *                 description: SNMP OID untuk deskripsi
 *               compositeIndex:
 *                 type: integer
 *                 nullable: true
 *                 description: Index komposit SNMP
 *     responses:
 *       201:
 *         description: ONU berhasil dibuat
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
 *       409:
 *         description: ONU sudah ada
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
  try {
    // Authentication check
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Validate request body
    const validation = onuCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const onuRepo = getOnuRepository()
    
    // Check if OLT exists
    const oltExists = await prisma.olt.findUnique({
      where: { id: validation.data.oltId }
    })
    
    if (!oltExists) {
      return NextResponse.json(
        { error: 'OLT tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if ONU with same gponOnu already exists for this OLT
    const existingOnu = await onuRepo.findByGponOnu(validation.data.oltId, validation.data.gponOnu)
    
    if (existingOnu) {
      return NextResponse.json(
        { error: 'ONU dengan GPON ID ini sudah ada di OLT yang sama' },
        { status: 409 }
      )
    }

    // Prepare data for creation
    const createData: any = {
      oltId: validation.data.oltId,
      name: validation.data.name,
      gponOnu: validation.data.gponOnu,
      status: validation.data.status,
    }

    // Add optional fields if provided
    if (validation.data.description !== undefined) createData.description = validation.data.description
    if (validation.data.pppoe !== undefined) createData.pppoe = validation.data.pppoe
    if (validation.data.rxOlt !== undefined) createData.rxOlt = validation.data.rxOlt
    if (validation.data.rxOnu !== undefined) createData.rxOnu = validation.data.rxOnu
    if (validation.data.txOlt !== undefined) createData.txOlt = validation.data.txOlt
    if (validation.data.txOnu !== undefined) createData.txOnu = validation.data.txOnu
    if (validation.data.serialNumber !== undefined) createData.serialNumber = validation.data.serialNumber
    if (validation.data.actualType !== undefined) createData.actualType = validation.data.actualType
    if (validation.data.registerTime !== undefined) createData.registerTime = validation.data.registerTime ? new Date(validation.data.registerTime) : null
    if (validation.data.distance !== undefined) createData.distance = validation.data.distance
    if (validation.data.lastSeen !== undefined) createData.lastSeen = validation.data.lastSeen ? new Date(validation.data.lastSeen) : null
    if (validation.data.registrationMode !== undefined) createData.registrationMode = validation.data.registrationMode
    if (validation.data.softwareVersion !== undefined) createData.softwareVersion = validation.data.softwareVersion
    if (validation.data.hardwareVersion !== undefined) createData.hardwareVersion = validation.data.hardwareVersion
    if (validation.data.temperature !== undefined) createData.temperature = validation.data.temperature
    if (validation.data.laserBiasCurrent !== undefined) createData.laserBiasCurrent = validation.data.laserBiasCurrent
    if (validation.data.vendorId !== undefined) createData.vendorId = validation.data.vendorId
    if (validation.data.equipmentId !== undefined) createData.equipmentId = validation.data.equipmentId
    if (validation.data.firmwareVersion !== undefined) createData.firmwareVersion = validation.data.firmwareVersion
    if (validation.data.macAddress !== undefined) createData.macAddress = validation.data.macAddress
    if (validation.data.batteryStatus !== undefined) createData.batteryStatus = validation.data.batteryStatus
    if (validation.data.opticalTransceiverType !== undefined) createData.opticalTransceiverType = validation.data.opticalTransceiverType
    if (validation.data.lastDeregTime !== undefined) createData.lastDeregTime = validation.data.lastDeregTime ? new Date(validation.data.lastDeregTime) : null
    if (validation.data.authMode !== undefined) createData.authMode = validation.data.authMode
    if (validation.data.loid !== undefined) createData.loid = validation.data.loid
    if (validation.data.password !== undefined) createData.password = validation.data.password
    if (validation.data.configState !== undefined) createData.configState = validation.data.configState
    if (validation.data.powerLevel !== undefined) createData.powerLevel = validation.data.powerLevel
    if (validation.data.dyingGaspTime !== undefined) createData.dyingGaspTime = validation.data.dyingGaspTime ? new Date(validation.data.dyingGaspTime) : null
    if (validation.data.rxPowerStatus !== undefined) createData.rxPowerStatus = validation.data.rxPowerStatus
    if (validation.data.txPowerStatus !== undefined) createData.txPowerStatus = validation.data.txPowerStatus
    if (validation.data.rxBytes !== undefined) createData.rxBytes = validation.data.rxBytes ? BigInt(validation.data.rxBytes) : null
    if (validation.data.txBytes !== undefined) createData.txBytes = validation.data.txBytes ? BigInt(validation.data.txBytes) : null
    if (validation.data.rxPackets !== undefined) createData.rxPackets = validation.data.rxPackets ? BigInt(validation.data.rxPackets) : null
    if (validation.data.txPackets !== undefined) createData.txPackets = validation.data.txPackets ? BigInt(validation.data.txPackets) : null
    if (validation.data.rxErrors !== undefined) createData.rxErrors = validation.data.rxErrors ? BigInt(validation.data.rxErrors) : null
    if (validation.data.txErrors !== undefined) createData.txErrors = validation.data.txErrors ? BigInt(validation.data.txErrors) : null
    if (validation.data.rxDrops !== undefined) createData.rxDrops = validation.data.rxDrops ? BigInt(validation.data.rxDrops) : null
    if (validation.data.txDrops !== undefined) createData.txDrops = validation.data.txDrops ? BigInt(validation.data.txDrops) : null
    if (validation.data.wifiEnable !== undefined) createData.wifiEnable = validation.data.wifiEnable
    if (validation.data.wifiSsid !== undefined) createData.wifiSsid = validation.data.wifiSsid
    if (validation.data.wifiSecurityMode !== undefined) createData.wifiSecurityMode = validation.data.wifiSecurityMode
    if (validation.data.wifiChannel !== undefined) createData.wifiChannel = validation.data.wifiChannel
    if (validation.data.statusOid !== undefined) createData.statusOid = validation.data.statusOid
    if (validation.data.rxOltOid !== undefined) createData.rxOltOid = validation.data.rxOltOid
    if (validation.data.rxOnuOid !== undefined) createData.rxOnuOid = validation.data.rxOnuOid
    if (validation.data.nameOid !== undefined) createData.nameOid = validation.data.nameOid
    if (validation.data.descOid !== undefined) createData.descOid = validation.data.descOid
    if (validation.data.compositeIndex !== undefined) createData.compositeIndex = validation.data.compositeIndex

    // Create ONU
    const result = await onuRepo.create(createData)
    
    // Get created ONU
    const createdOnu = await onuRepo.findByGponOnu(validation.data.oltId, validation.data.gponOnu)
      .catch(() => null)

    return NextResponse.json({ onu: createdOnu }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating ONU:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'ONU dengan GPON ID ini sudah ada di OLT yang sama' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Cache for ONU data
let onuCache: Map<string, any> = new Map()
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Clear ONU cache
 * This function is used to invalidate the cache when ONU data changes
 */
export function clearOnuCache() {
  onuCache.clear()
  cacheTimestamp = 0
}

/**
 * Get cached ONU data or fetch from database
 */
async function getCachedOnus(oltId?: string) {
  const now = Date.now()
  const cacheKey = oltId || 'all'
  
  // Check if cache is valid
  if (onuCache.has(cacheKey) && (now - cacheTimestamp) < CACHE_DURATION) {
    return onuCache.get(cacheKey)
  }
  
  // Fetch from database
  const onuRepo = getOnuRepository()
  let onus
  
  if (oltId) {
    onus = await onuRepo.findByOltId(oltId)
  } else {
    onus = await onuRepo.findAll()
  }
  
  // Update cache
  onuCache.set(cacheKey, onus)
  cacheTimestamp = now
  
  return onus
}

/**
 * @swagger
 * /api/onus:
 *   get:
 *     summary: Get all ONUs
 *     description: Mendapatkan semua data ONU
 *     tags: [ONUs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: oltId
 *         schema:
 *           type: string
 *         description: Filter by OLT ID
 *     responses:
 *       200:
 *         description: List of ONUs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 onus:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ONU'
 *       401:
 *         description: Unauthorized
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
    // Authentication check
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const oltId = searchParams.get('oltId')
    
    // Get ONUs (with caching)
    const onus = await getCachedOnus(oltId || undefined)

    return NextResponse.json({ onus })
  } catch (error: any) {
    console.error('Error fetching ONUs:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
