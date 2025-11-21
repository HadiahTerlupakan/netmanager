import { startOltSyncScheduler } from './olt-sync-scheduler'
import { startMikroTikPingScheduler } from './mikrotik-ping-scheduler'

const OLT_SYNC_CRON = process.env.OLT_SYNC_CRON || '*/5 * * * *'
const MIKROTIK_PING_CRON = process.env.MIKROTIK_PING_CRON || '*/5 * * * *'

export function startAllSchedulers() {
  console.log('[Scheduler] Starting all schedulers...')
  
  startOltSyncScheduler(OLT_SYNC_CRON)
  startMikroTikPingScheduler(MIKROTIK_PING_CRON)
  
  console.log('[Scheduler] All schedulers started successfully')
}

