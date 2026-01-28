import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api-response'

/**
 * Memory Metrics Endpoint
 * Provides real-time memory usage information for monitoring
 */
export async function GET(_req: NextRequest) {
  const memoryUsage = process.memoryUsage()

  // Calculate heap usage percentage
  const heapUsedPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)

  return apiSuccess({
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      external: formatBytes(memoryUsage.external),
      rss: formatBytes(memoryUsage.rss),
      arrayBuffers: formatBytes(memoryUsage.arrayBuffers),
      heapUsedPercentage: `${heapUsedPercentage}%`,
    },
    raw: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers,
    },
    uptime: {
      seconds: Math.round(process.uptime()),
      formatted: formatUptime(process.uptime()),
    },
    cpu: process.cpuUsage(),
    // Health indicators
    health: {
      status: heapUsedPercentage < 80 ? 'healthy' : heapUsedPercentage < 90 ? 'warning' : 'critical',
      heapUsedPercentage,
    },
  })
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024
  return `${mb.toFixed(2)}MB`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m ${Math.floor(seconds % 60)}s`
  }
}
