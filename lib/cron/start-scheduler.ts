/**
 * Start semua scheduler saat aplikasi start
 * File ini akan dipanggil saat aplikasi Next.js start
 */

import { startOltSyncScheduler } from './olt-sync-scheduler'
import { startMikroTikPingScheduler } from './mikrotik-ping-scheduler'
import { startOnuSyncScheduler } from './onu-sync-scheduler'
import { startSnmpTrapReceiver } from '@/lib/services/snmp-trap-receiver'

// Start OLT sync scheduler (setiap 5 menit)
// Bisa diubah melalui environment variable
const OLT_SYNC_CRON = process.env.OLT_SYNC_CRON || '*/5 * * * *'

// Start MikroTik ping check scheduler (setiap 5 menit)
// Bisa diubah melalui environment variable
const MIKROTIK_PING_CRON = process.env.MIKROTIK_PING_CRON || '*/5 * * * *'

// Start ONU sync scheduler (setiap 30 menit) - untuk include Basic Info
// Bisa diubah melalui environment variable
const ONU_SYNC_CRON = process.env.ONU_SYNC_CRON || '*/30 * * * *'

// SNMP Trap Receiver port (default: 162, tapi bisa pakai 1162 jika non-root)
const SNMP_TRAP_PORT = parseInt(process.env.SNMP_TRAP_PORT || '1162', 10)
const SNMP_TRAP_ENABLED = process.env.SNMP_TRAP_ENABLED !== 'false'

export function startAllSchedulers() {
  console.log('[Scheduler] Starting all schedulers...')
  
  // Start OLT sync scheduler
  startOltSyncScheduler(OLT_SYNC_CRON)
  
  // Start MikroTik ping check scheduler
  startMikroTikPingScheduler(MIKROTIK_PING_CRON)
  
  // Start ONU sync scheduler (include Basic Info fields)
  startOnuSyncScheduler(ONU_SYNC_CRON)
  
  // Start SNMP Trap Receiver for real-time ONU events
  if (SNMP_TRAP_ENABLED) {
    try {
      startSnmpTrapReceiver(SNMP_TRAP_PORT)
      console.log(`[Scheduler] SNMP Trap Receiver started on port ${SNMP_TRAP_PORT}`)
    } catch (error: any) {
      console.error('[Scheduler] Failed to start SNMP Trap Receiver:', error.message)
      console.log('[Scheduler] Continuing without SNMP Trap (polling only mode)')
    }
  } else {
    console.log('[Scheduler] SNMP Trap Receiver disabled (polling only mode)')
  }
  
  console.log('[Scheduler] All schedulers started successfully')
}

// Auto-start saat file ini di-import (hanya di server-side) - DISABLED
// if (typeof window === 'undefined') {
//   // Tunggu sedikit untuk memastikan database connection ready
//   setTimeout(() => {
//     startAllSchedulers()
//   }, 2000)
// }

