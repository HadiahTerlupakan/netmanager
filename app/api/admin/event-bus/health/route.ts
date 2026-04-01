import { NextResponse } from 'next/server'
import { getQueueStats, getOutboxStats, getWorkerStatus } from '@/lib/event-bus'

/**
 * GET /api/admin/event-bus/health
 * Returns health status of the Event Bus system (BullMQ queues, Outbox, Workers)
 */
export async function GET() {
  try {
    const [queueStats, outboxStats, workerStatus] = await Promise.all([
      getQueueStats(),
      getOutboxStats(),
      Promise.resolve(getWorkerStatus()),
    ])

    const isHealthy =
      workerStatus.some(w => w.isRunning) &&
      outboxStats.dead < 100 // Alert if too many dead events

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      queues: queueStats,
      outbox: outboxStats,
      workers: workerStatus,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
