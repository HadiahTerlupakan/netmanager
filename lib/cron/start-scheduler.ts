/**
 * Start semua scheduler saat aplikasi start
 * File ini akan dipanggil saat aplikasi Next.js start
 */

import { startOltSyncScheduler } from './olt-sync-scheduler'
// import { startOnuSyncScheduler } from './onu-sync-scheduler'

// Start OLT sync scheduler (setiap 5 menit)
// Bisa diubah melalui environment variable
const OLT_SYNC_CRON = process.env.OLT_SYNC_CRON || '*/5 * * * *'

// Start ONU sync scheduler (setiap 5 menit) - DISABLED
// Bisa diubah melalui environment variable
// const ONU_SYNC_CRON = process.env.ONU_SYNC_CRON || '*/5 * * * *'

export function startAllSchedulers() {
  console.log('[Scheduler] Starting all schedulers...')
  
  // Start OLT sync scheduler
  startOltSyncScheduler(OLT_SYNC_CRON)
  
  // Start ONU sync scheduler - DISABLED
  // startOnuSyncScheduler(ONU_SYNC_CRON)
  
  console.log('[Scheduler] All schedulers started successfully')
}

// Auto-start saat file ini di-import (hanya di server-side) - DISABLED
// if (typeof window === 'undefined') {
//   // Tunggu sedikit untuk memastikan database connection ready
//   setTimeout(() => {
//     startAllSchedulers()
//   }, 2000)
// }

