import 'dotenv/config'
import { cronRegistry } from './lib/cron-registry'

// Safeguard: Set Default Timezone for the entire process if not set
if (!process.env.TZ) {
    process.env.TZ = 'Asia/Jakarta'
}
console.log(`[Worker] Starting cron worker... Timezone: ${process.env.TZ} (${new Date().toString()})`)

// Start all cron jobs
cronRegistry.startAll()

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    console.log(`[Worker] ${signal} received, shutting down gracefully`)
    cronRegistry.stopAll()
    // Give some time for tasks to stop if needed
    setTimeout(() => {
        process.exit(0)
    }, 1000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
