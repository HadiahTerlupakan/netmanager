import { checkAllMikroTikRouterStatus } from './mikrotik-ping-check'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { type Server as SocketIOServer } from 'socket.io'

class MikroTikMonitor {
    private intervalId: ReturnType<typeof setTimeout> | null = null
    private readonly CHECK_INTERVAL = 60000 * 5 // 5 minutes
    private io: SocketIOServer | null = null

    public setSocketServer(io: SocketIOServer) {
        this.io = io
    }

    public start() {
        if (this.intervalId) {
            console.log('[MikroTikMonitor] Already running')
            return
        }

        console.log('[MikroTikMonitor] Starting monitoring service...')

        // Initial check
        this.checkStatus()

        // Schedule periodic checks
        this.intervalId = setInterval(() => {
            this.checkStatus()
        }, this.CHECK_INTERVAL)
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
            console.log('[MikroTikMonitor] Stopped')
        }
    }

    private async checkStatus() {
        try {
            console.log('[MikroTikMonitor] Running scheduled status check...')
            const updatedCount = await checkAllMikroTikRouterStatus()

            const routerRepository = getMikroTikRouterRepository()
            const _stats = await routerRepository.getStatistics() // simple stats method we might need if not exists, or just emit updated count

            console.log(`[MikroTikMonitor] Check complete. Updated ${updatedCount} routers.`)

            if (this.io) {
                this.io.emit('mikrotik:update', {
                    timestamp: new Date(),
                    updatedCount,
                    // stats // Optional: send full stats if needed
                })
            }
        } catch (error: unknown) {
            console.error('[MikroTikMonitor] Error in checkStatus:', error)
        }
    }
}

export const mikroTikMonitor = new MikroTikMonitor()
