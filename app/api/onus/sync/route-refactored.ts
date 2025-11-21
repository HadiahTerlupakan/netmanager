import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { ONUDataFetcher } from '@/lib/services/onu-sync/onu-data-fetcher'
import type { OnuSyncData } from '@/lib/types/onu-sync'

export type { OnuSyncData } from '@/lib/types/onu-sync'

/**
 * Menghitung jumlah ONU dari OLT via SNMP (hanya count, tidak ambil semua data)
 * Fungsi ini lebih cepat karena hanya mengambil OID status untuk menghitung jumlah ONU
 */
export async function countOnuFromSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<number> {
  console.log(`[C300-GPON-SNMP-Count] Counting ONUs from OLT (${ipAddress}) via SNMP...`)

  try {
    const dataFetcher = new ONUDataFetcher()
    const count = await dataFetcher.countOnus(ipAddress, port, community, version)

    console.log(`[C300-GPON-SNMP-Count] Found ${count} ONUs on OLT ${ipAddress}`)
    return count
  } catch (error: any) {
    console.warn(`[C300-GPON-SNMP-Count] Failed to count ONUs: ${error.message || error}`)
    return 0
  }
}

/**
 * Main function untuk fetch ONU data dari C300 OLT via SNMP
 * Refactored untuk menggunakan modular architecture
 */
export async function getC300GponOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string,
  maxResults?: number
): Promise<Array<OnuSyncData>> {
  console.log(`[C300-GPON-SNMP] Fetching ONU data from OLT (${ipAddress}) via SNMP (Refactored)...`)

  try {
    const dataFetcher = new ONUDataFetcher()
    const onuData = await dataFetcher.fetchOnuData({
      ipAddress,
      port,
      community,
      version,
      oltId,
      maxResults
    })

    return onuData
  } catch (error: any) {
    console.error(`[C300-GPON-SNMP] Error:`, error)
    throw error
  }
}