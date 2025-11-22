import { startOltSyncScheduler } from './olt-sync-scheduler'
import { startMikroTikPingScheduler } from './mikrotik-ping-scheduler'
import { startOnuSyncScheduler } from './onu-sync-scheduler'

const OLT_SYNC_CRON = process.env.OLT_SYNC_CRON || '*/5 * * * *'
const MIKROTIK_PING_CRON = process.env.MIKROTIK_PING_CRON || '*/5 * * * *'
const ONU_SYNC_CRON = process.env.ONU_SYNC_CRON || '*/5 * * * *' // Default: setiap 5 menit

export function startAllSchedulers() {
  console.log('[Scheduler] Starting all schedulers...')
  
  startOltSyncScheduler(OLT_SYNC_CRON)
  startMikroTikPingScheduler(MIKROTIK_PING_CRON)
  startOnuSyncScheduler(ONU_SYNC_CRON)
  
  console.log('[Scheduler] All schedulers started successfully')
}

