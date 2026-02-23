import { checkAllMikroTikRouterStatus } from './mikrotik-ping-check'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { type Server as SocketIOServer } from 'socket.io'

class MikroTikMonitor {
    private intervalId: ReturnType<typeof setTimeout> | null = null
    private readonly CHECK_INTERVAL = 60000 * 5 // 5 minutes
    private io: SocketIOServer | null = null
    private errorCount: number = 0
    private readonly MAX_ERRORS = 5

    public setSocketServer(io: SocketIOServer) {
        this.io = io
    }

    public start() {
        if (this.intervalId) {
            // console.log('[MikroTikMonitor] Already running')
            return
        }

        // console.log('[MikroTikMonitor] Starting monitoring service...')
        this.errorCount = 0

        // Initial check
        this.checkStatus()

        // Schedule periodic checks
        this.scheduleNext()
    }

    public stop() {
        if (this.intervalId) {
            clearTimeout(this.intervalId)
            this.intervalId = null
            // console.log('[MikroTikMonitor] Stopped')
        }
    }

    private scheduleNext() {
        // Backoff: after 2 consecutive errors, increase interval
        const backoff = this.errorCount > 2 ? Math.min(2 ** (this.errorCount - 2), 8) : 1
        const interval = this.CHECK_INTERVAL * backoff

        this.intervalId = setTimeout(() => {
            this.checkStatus().then(() => {
                if (this.intervalId) this.scheduleNext()
            })
        }, interval)
    }

    private isConnectionError(error: unknown): boolean {
        if (error && typeof error === 'object') {
            const code = (error as { code?: string }).code
            const message = (error as { message?: string }).message || ''
            return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT'
                || message.includes('ECONNREFUSED') || message.includes('Connection refused')
        }
        return false
    }

    private async checkStatus() {
        try {
            const updatedCount = await checkAllMikroTikRouterStatus()

            const routerRepository = getMikroTikRouterRepository()
            const _stats = await routerRepository.getStatistics()

            if (this.errorCount > 0) {
                // console.log('[MikroTikMonitor] Connection restored, resuming normal operation')
            }
            this.errorCount = 0

            // console.log(`[MikroTikMonitor] Check complete. Updated ${updatedCount} routers.`)

            if (this.io) {
                this.io.emit('mikrotik:update', {
                    timestamp: new Date(),
                    updatedCount,
                })
            }
        } catch (error: unknown) {
            this.errorCount++

            if (this.isConnectionError(error)) {
                const code = (error as { code?: string }).code || 'ECONNREFUSED'
                console.warn(`[MikroTikMonitor] DB connection failed (${code}) - attempt ${this.errorCount}/${this.MAX_ERRORS}`)
            } else {
                console.error(`[MikroTikMonitor] Error (${this.errorCount}/${this.MAX_ERRORS}):`, error instanceof Error ? error.message : error)
            }

            if (this.errorCount >= this.MAX_ERRORS) {
                console.error('[MikroTikMonitor] Stopping after too many consecutive failures')
                this.stop()
            }
        }
    }
}

export const mikroTikMonitor = new MikroTikMonitor()
