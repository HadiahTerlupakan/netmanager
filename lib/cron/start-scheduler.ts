import { startOltSyncScheduler } from './olt-sync-scheduler'
import { startMikroTikPingScheduler } from './mikrotik-ping-scheduler'
import { startOnuSyncScheduler } from './onu-sync-scheduler'
import { startTagihanGeneratorScheduler, startAutoInvoiceScheduler } from './tagihan-generator-scheduler'
import { startTagihanStatusUpdater } from './tagihan-status-updater'

const OLT_SYNC_CRON = process.env.OLT_SYNC_CRON || '*/5 * * * *'
const MIKROTIK_PING_CRON = process.env.MIKROTIK_PING_CRON || '*/5 * * * *'
const ONU_SYNC_CRON = process.env.ONU_SYNC_CRON || '*/5 * * * *' // Default: setiap 5 menit
const TAGIHAN_GENERATOR_CRON = process.env.TAGIHAN_GENERATOR_CRON || '0 0 1 * *' // Default: setiap tanggal 1 jam 00:00
const TAGIHAN_STATUS_UPDATER_CRON = process.env.TAGIHAN_STATUS_UPDATER_CRON || '0 0 * * *' // Default: setiap hari jam 00:00
const AUTO_INVOICE_CRON = process.env.AUTO_INVOICE_CRON || '0 0 * * *' // Default: setiap hari jam 00:00

export function startAllSchedulers() {
  console.log('[Scheduler] Starting all schedulers...')
  
  startOltSyncScheduler(OLT_SYNC_CRON)
  startMikroTikPingScheduler(MIKROTIK_PING_CRON)
  startOnuSyncScheduler(ONU_SYNC_CRON)
  startTagihanGeneratorScheduler(TAGIHAN_GENERATOR_CRON)
  startTagihanStatusUpdater(TAGIHAN_STATUS_UPDATER_CRON)
  startAutoInvoiceScheduler(AUTO_INVOICE_CRON)
  
  console.log('[Scheduler] All schedulers started successfully')
}

