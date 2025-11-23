/**
 * API untuk update data ONU yang sedang ditampilkan menggunakan SNMP GET
 * Hanya update ONU yang sedang ditampilkan (misalnya 5 ONU per halaman)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository } from '@/lib/repositories'
import { updateMultipleOnusViaGetWithOids } from '@/lib/services/onu-update-snmp-get'
import { getOnuRepository } from '@/lib/repositories'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { onuList } = body // Array of { gponOnu: string, oltId: string }

    if (!onuList || !Array.isArray(onuList) || onuList.length === 0) {
      return NextResponse.json(
        { error: 'onuList is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    console.log(`[ONU-Update-API] Updating ${onuList.length} ONUs via SNMP GET...`)

    // Group ONUs by OLT untuk efisiensi
    const onusByOlt = new Map<string, Array<{ gponOnu: string }>>()
    
    for (const onu of onuList) {
      if (!onu.gponOnu || !onu.oltId) {
        console.warn(`[ONU-Update-API] Skipping invalid ONU entry:`, onu)
        continue
      }

      if (!onusByOlt.has(onu.oltId)) {
        onusByOlt.set(onu.oltId, [])
      }
      onusByOlt.get(onu.oltId)!.push({ gponOnu: onu.gponOnu })
    }

    const updatedOnus: Array<{
      gponOnu: string
      oltId: string
      updated: boolean
      data?: any
    }> = []

    const oltRepo = getOLTRepository()
    const onuRepo = getOnuRepository()

    // Update ONUs per OLT
    for (const [oltId, onus] of onusByOlt.entries()) {
      try {
        const olt = await oltRepo.findById(oltId)
        if (!olt) {
          console.warn(`[ONU-Update-API] OLT ${oltId} not found, skipping...`)
          continue
        }

        if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
          console.warn(`[ONU-Update-API] OLT ${olt.name} is not SNMP connected, skipping...`)
          continue
        }

        console.log(`[ONU-Update-API] Updating ${onus.length} ONUs for OLT ${olt.name}...`)

        // Ambil OID dari database untuk setiap ONU (untuk fast SNMP GET)
        const onusWithOids = await Promise.all(
          onus.map(async (onu) => {
            const existingOnu = await onuRepo.findByGponOnu(oltId, onu.gponOnu)
            return {
              gponOnu: onu.gponOnu,
              statusOid: existingOnu?.statusOid || null,
              rxOltOid: existingOnu?.rxOltOid || null,
              rxOnuOid: existingOnu?.rxOnuOid || null,
              nameOid: existingOnu?.nameOid || null,
              descOid: existingOnu?.descOid || null,
              compositeIndex: existingOnu?.compositeIndex || null,
            }
          })
        )

        // Update via SNMP GET menggunakan OID yang tersimpan
        const updatedData = await updateMultipleOnusViaGetWithOids(
          olt.ipAddress,
          olt.snmpPort || 161,
          olt.snmpCommunityWrite,
          olt.snmpVersion || '2c',
          onusWithOids
        )

        // Update database dengan data terbaru
        for (const updateData of updatedData) {
          if (!updateData.gponOnu) continue

          try {
            // Ambil data existing dari database untuk fallback
            const existingOnu = await onuRepo.findByGponOnu(oltId, updateData.gponOnu)
            
            // Hanya update jika ada data dari SNMP GET (minimal status harus ada)
            if (!updateData.status) {
              console.warn(`[ONU-Update-API] Skipping ${updateData.gponOnu}: No status data from SNMP GET`)
              updatedOnus.push({
                gponOnu: updateData.gponOnu,
                oltId: oltId,
                updated: false,
              })
              continue
            }
            
            // Hanya update field yang benar-benar ada datanya dari SNMP GET
            // Jangan overwrite dengan "Unknown" atau null jika SNMP GET gagal
            const upsertData: any = {
              oltId: oltId,
              gponOnu: updateData.gponOnu,
              lastSeen: new Date(),
            }
            
            // Status: Hanya update jika ada data dari SNMP GET dan bukan "Unknown"
            if (updateData.status && updateData.status !== 'Unknown') {
              upsertData.status = updateData.status
            } else if (existingOnu?.status && existingOnu.status !== 'Unknown') {
              upsertData.status = existingOnu.status // Keep existing status jika SNMP GET tidak dapat status
            } else {
              // Hanya set Unknown jika benar-benar tidak ada data sama sekali
              upsertData.status = updateData.status || existingOnu?.status || 'Unknown'
            }
            
            if (updateData.name) {
              upsertData.name = updateData.name
            } else if (existingOnu?.name) {
              upsertData.name = existingOnu.name
            } else {
              upsertData.name = ''
            }
            
            if (updateData.description !== undefined && updateData.description !== null) {
              upsertData.description = updateData.description
            } else if (existingOnu?.description !== undefined) {
              upsertData.description = existingOnu.description
            } else {
              upsertData.description = null
            }
            
            if (updateData.rxOlt && updateData.rxOlt !== 'N/A') {
              upsertData.rxOlt = updateData.rxOlt
            } else if (existingOnu?.rxOlt) {
              upsertData.rxOlt = existingOnu.rxOlt
            } else {
              upsertData.rxOlt = null
            }
            
            if (updateData.rxOnu && updateData.rxOnu !== 'N/A') {
              upsertData.rxOnu = updateData.rxOnu
            } else if (existingOnu?.rxOnu) {
              upsertData.rxOnu = existingOnu.rxOnu
            } else {
              upsertData.rxOnu = null
            }
            
            if (updateData.pppoe) {
              upsertData.pppoe = updateData.pppoe
            } else if (existingOnu?.pppoe) {
              upsertData.pppoe = existingOnu.pppoe
            } else {
              upsertData.pppoe = null
            }
            
            if (updateData.serialNumber) {
              upsertData.serialNumber = updateData.serialNumber
            } else if (existingOnu?.serialNumber) {
              upsertData.serialNumber = existingOnu.serialNumber
            } else {
              upsertData.serialNumber = null
            }
            
            if (updateData.actualType) {
              upsertData.actualType = updateData.actualType
            } else if (existingOnu?.actualType) {
              upsertData.actualType = existingOnu.actualType
            } else {
              upsertData.actualType = null
            }
            
            // Upsert ke database
            await onuRepo.upsert(oltId, updateData.gponOnu, upsertData)

            updatedOnus.push({
              gponOnu: updateData.gponOnu,
              oltId: oltId,
              updated: true,
              data: updateData,
            })
          } catch (error: any) {
            console.error(`[ONU-Update-API] Error updating ONU ${updateData.gponOnu}:`, error.message)
            updatedOnus.push({
              gponOnu: updateData.gponOnu,
              oltId: oltId,
              updated: false,
            })
          }
        }

        console.log(`[ONU-Update-API] Successfully updated ${updatedData.length} ONUs for OLT ${olt.name}`)
      } catch (error: any) {
        console.error(`[ONU-Update-API] Error updating ONUs for OLT ${oltId}:`, error.message)
        // Mark all ONUs in this OLT as failed
        for (const onu of onus) {
          updatedOnus.push({
            gponOnu: onu.gponOnu,
            oltId: oltId,
            updated: false,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedOnus.filter(u => u.updated).length,
      total: updatedOnus.length,
      onus: updatedOnus,
    })
  } catch (error: any) {
    console.error('[ONU-Update-API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update ONUs' },
      { status: 500 }
    )
  }
}

