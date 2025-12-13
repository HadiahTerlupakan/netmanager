import { NextRequest, NextResponse } from 'next/server'
import { snmpTable } from '@/lib/utils/snmp-helpers'
import { SNMPMIBHelper, ONU_MIB_TABLES } from '@/lib/utils/snmp-mib-helper'
import { getOLTRepository } from '@/lib/repositories'

import { verifyAuth } from '@/lib/auth'
/**
 * POST /api/onus/test-table
 * Test SNMP TABLE untuk ONU tertentu menggunakan OID yang sudah tersimpan
 */
export async function POST(req: NextRequest) {
  try {
        // Authentication check
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

    const body = await req.json()
    // Frontend mengirim onuId yang sebenarnya adalah gponOnu (karena API /api/onus mengembalikan id: gponOnu)
    // Jadi kita terima baik onuId (gponOnu) atau gponOnu langsung
    const { onuId, gponOnu, oltId } = body

    // Gunakan gponOnu jika ada, jika tidak gunakan onuId (yang sebenarnya adalah gponOnu dari frontend)
    const targetGponOnu = gponOnu || onuId

    if (!targetGponOnu || !oltId) {
      return NextResponse.json(
        { error: 'gponOnu (atau onuId) dan oltId diperlukan' },
        { status: 400 }
      )
    }

    // Ambil data OLT untuk mendapatkan SNMP credentials
    const oltRepo = getOLTRepository()
    const olt = await oltRepo.findById(oltId)
    
    if (!olt) {
      return NextResponse.json(
        { error: 'OLT tidak ditemukan' },
        { status: 404 }
      )
    }

    if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
      return NextResponse.json(
        { error: 'OLT tidak terhubung atau SNMP community tidak tersedia' },
        { status: 400 }
      )
    }

    // Ambil data ONU untuk mendapatkan OID yang tersimpan
    // Gunakan Prisma langsung untuk memastikan semua field OID di-include
    const { prisma } = await import('@/lib/prisma')
    const onu = await prisma.onu.findUnique({
      where: {
        oltId_gponOnu: {
          oltId,
          gponOnu: targetGponOnu,
        },
      },
      select: {
        id: true,
        oltId: true,
        gponOnu: true,
        name: true,
        statusOid: true,
        rxOltOid: true,
        rxOnuOid: true,
        nameOid: true,
        descOid: true,
        compositeIndex: true,
      },
    })

    if (!onu) {
      console.log(`[SNMP-Table-Test] ONU not found: oltId=${oltId}, gponOnu=${targetGponOnu}`)
      return NextResponse.json(
        { error: `ONU tidak ditemukan: ${targetGponOnu} pada OLT ${oltId}` },
        { status: 404 }
      )
    }

    // Cek apakah ONU memiliki OID yang diperlukan
    if (!onu.statusOid || !onu.compositeIndex) {
      return NextResponse.json(
        { error: 'ONU belum memiliki OID yang tersimpan. Silakan sync ONU terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Extract onuIdNumber dari gponOnu (format: Frame/Slot/Port:OnuID)
    const parsed = SNMPMIBHelper.parseGponOnu(onu.gponOnu)
    if (!parsed) {
      return NextResponse.json(
        { error: `Format gponOnu tidak valid: ${onu.gponOnu}` },
        { status: 400 }
      )
    }

    const { compositeIndex: parsedCompositeIndex, onuId: onuIdNumber } = parsed

    // Gunakan compositeIndex dari database jika ada, jika tidak gunakan yang di-parse
    const targetCompositeIndex = onu.compositeIndex || parsedCompositeIndex

    console.log(`[SNMP-Table-Test] Testing SNMP TABLE for ONU ${onu.gponOnu}`)
    console.log(`[SNMP-Table-Test] Status OID: ${onu.statusOid}`)
    console.log(`[SNMP-Table-Test] Composite Index: ${targetCompositeIndex}`)
    console.log(`[SNMP-Table-Test] ONU ID: ${onuIdNumber}`)

    // Gunakan MIB Helper untuk fetch data
    const tableConfigs = [
      { tableName: 'status' as const, columns: ['4'], name: 'Status' },
      { tableName: 'device' as const, columns: ['2'], name: 'Name' },
      { tableName: 'device' as const, columns: ['5'], name: 'Serial' },
      { tableName: 'rxOlt' as const, columns: ['2'], name: 'RX OLT' },
      { tableName: 'rxOnu' as const, columns: ['10'], name: 'RX ONU' },
    ]

    // Fetch semua tabel secara paralel menggunakan MIB Helper
    const tableResultsArray = await Promise.all(
      tableConfigs.map(config =>
        SNMPMIBHelper.fetchTable(
          olt.ipAddress,
          olt.snmpPort || 161,
          olt.snmpCommunityWrite,
          olt.snmpVersion || '2c',
          config.tableName,
          config.columns,
          30000
        ).then(results => ({
          name: config.name,
          tableName: config.tableName,
          columns: config.columns,
          results,
        })).catch(error => {
          console.warn(`[SNMP-Table-Test] Failed to fetch ${config.name}:`, error.message || error)
          return {
            name: config.name,
            tableName: config.tableName,
            columns: config.columns,
            results: {},
          }
        })
      )
    )

    // Gabungkan semua hasil
    const allResults: Record<string, string> = {}
    for (const tableResult of tableResultsArray) {
      for (const [key, value] of Object.entries(tableResult.results)) {
        allResults[`${tableResult.name}.${key}`] = value
      }
    }

    console.log(`[SNMP-Table-Test] Raw table results: ${Object.keys(allResults).length} total entries`)
    console.log(`[SNMP-Table-Test] Sample keys:`, Object.keys(allResults).slice(0, 10))

    // Filter results untuk ONU ini saja (menggunakan compositeIndex.onuIdNumber)
    // Format key dari snmpTable setelah gabungan: "TableName.columnOid.index"
    // Contoh: "Status.4.268632320.3" untuk Status column 4, compositeIndex 268632320, onuIdNumber 3
    const filteredResults: Record<string, string> = {}
    const compositeIndexStr = targetCompositeIndex.toString()
    const targetIndex = onuIdNumber ? `${compositeIndexStr}.${onuIdNumber}` : compositeIndexStr
    
    console.log(`[SNMP-Table-Test] Filtering for target index: ${targetIndex}`)
    
    // Pattern untuk matching: bisa berupa "compositeIndex.onuId" atau "compositeIndex.onuId.extra"
    // Contoh: "268632320.3" atau "268632320.3.1"
    const targetIndexPattern = new RegExp(`^${targetIndex.replace(/\./g, '\\.')}(\\.|$)`)
    
    for (const [key, value] of Object.entries(allResults)) {
      // Key format: "TableName.columnOid.index" atau "TableName.columnOid.columnOid.index" (jika ada duplikasi)
      // Contoh: "Status.4.268632320.3" atau "Status.4.4.268632320.3"
      const keyParts = key.split('.')
      if (keyParts.length >= 3) {
        // Ambil index (bagian setelah TableName dan columnOid)
        // Handle duplikasi columnOid: skip jika keyParts[1] === keyParts[2]
        let indexStart = 2
        if (keyParts.length > 3 && keyParts[1] === keyParts[2]) {
          // Ada duplikasi columnOid, skip yang pertama
          indexStart = 3
        }
        const indexPart = keyParts.slice(indexStart).join('.')
        
        // Cek apakah index dimulai dengan targetIndex (bisa ada bagian tambahan di akhir)
        if (targetIndexPattern.test(indexPart)) {
          filteredResults[key] = value
        }
      }
    }
    
    console.log(`[SNMP-Table-Test] Sample allResults keys (first 10):`, Object.keys(allResults).slice(0, 10))
    console.log(`[SNMP-Table-Test] Sample filtered keys:`, Object.keys(filteredResults).slice(0, 10))

    console.log(`[SNMP-Table-Test] Filtered results: ${Object.keys(filteredResults).length} entries for ONU ${onu.gponOnu}`)
    if (Object.keys(filteredResults).length > 0) {
      console.log(`[SNMP-Table-Test] Filtered keys:`, Object.keys(filteredResults))
    }

    // Format baseOid dan columns untuk display menggunakan MIB Helper
    const baseOids = {
      status: ONU_MIB_TABLES.status.baseOid,
      name: ONU_MIB_TABLES.device.baseOid,
      serial: ONU_MIB_TABLES.device.baseOid,
      rxOlt: ONU_MIB_TABLES.rxOlt.baseOid,
      rxOnu: ONU_MIB_TABLES.rxOnu.baseOid,
    }

    const baseOidDisplay = tableConfigs.map(c => {
      const table = ONU_MIB_TABLES[c.tableName]
      return `${c.name}: ${table.baseOid}.${c.columns.join(',')}`
    }).join('; ')
    const columnsDisplay = tableConfigs.flatMap(c => c.columns.map(col => `${c.name}.${col}`)).join(', ')

    return NextResponse.json({
      success: true,
      onu: {
        id: onu.id,
        gponOnu: onu.gponOnu,
        name: onu.name,
        compositeIndex: targetCompositeIndex,
        onuId: onuIdNumber,
      },
      baseOid: baseOidDisplay,
      columns: columnsDisplay,
      baseOids: baseOids,
      tableConfigs: tableConfigs.map(c => {
        const table = ONU_MIB_TABLES[c.tableName]
        return { name: c.name, baseOid: table.baseOid, columns: c.columns }
      }),
      results: filteredResults,
      totalResults: Object.keys(filteredResults).length,
      rawTotalResults: Object.keys(allResults).length,
    })
  } catch (error: any) {
    console.error('[SNMP-Table-Test] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal test SNMP TABLE' },
      { status: 500 }
    )
  }
}

