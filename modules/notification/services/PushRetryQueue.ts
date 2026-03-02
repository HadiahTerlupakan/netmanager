import { redis } from '@/lib/redis'

const RETRY_QUEUE_KEY = 'push:retry:queue'
const RETRY_PROCESSING_KEY = 'push:retry:processing'
const MAX_RETRIES = 3
const RETRY_INTERVAL_MS = 30_000 // 30 seconds between retry cycles

interface PushRetryItem {
    id: string
    type: 'expo' | 'web'
    userId: string
    title: string
    body: string
    data?: Record<string, unknown>
    retryCount: number
    createdAt: number
    lastAttemptAt?: number
    // Expo-specific
    pushToken?: string
    // Web-push specific
    endpoint?: string
    p256dh?: string
    auth?: string
}

/**
 * Enqueue a failed push notification for retry
 */
export async function enqueuePushRetry(item: Omit<PushRetryItem, 'id' | 'retryCount' | 'createdAt'>): Promise<void> {
    try {
        const retryItem: PushRetryItem = {
            ...item,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            retryCount: 0,
            createdAt: Date.now(),
        }
        await redis.lpush(RETRY_QUEUE_KEY, JSON.stringify(retryItem))
        // console.log(`[PushRetry] Enqueued ${item.type} push for user ${item.userId}`)
    } catch (error) {
        console.error('[PushRetry] Failed to enqueue:', error)
    }
}

/**
 * Process the retry queue - called periodically
 */
export async function processRetryQueue(): Promise<{ processed: number; succeeded: number; dropped: number }> {
    const stats = { processed: 0, succeeded: 0, dropped: 0 }

    try {
        // Move items from queue to processing (atomic)
        const queueLength = await redis.llen(RETRY_QUEUE_KEY)
        if (queueLength === 0) return stats

        // Process up to 50 items per cycle
        const batchSize = Math.min(queueLength, 50)

        for (let i = 0; i < batchSize; i++) {
            const raw = await redis.rpoplpush(RETRY_QUEUE_KEY, RETRY_PROCESSING_KEY)
            if (!raw) break

            let item: PushRetryItem
            try {
                item = JSON.parse(raw)
            } catch {
                await redis.lrem(RETRY_PROCESSING_KEY, 1, raw)
                continue
            }

            stats.processed++
            item.retryCount++
            item.lastAttemptAt = Date.now()

            // Drop if max retries exceeded or too old (> 1 hour)
            if (item.retryCount > MAX_RETRIES || Date.now() - item.createdAt > 3_600_000) {
                console.warn(`[PushRetry] Dropping push for user ${item.userId} after ${item.retryCount} retries`)
                await redis.lrem(RETRY_PROCESSING_KEY, 1, raw)
                stats.dropped++
                continue
            }

            let success = false

            try {
                if (item.type === 'expo' && item.pushToken) {
                    success = await retryExpoPush(item)
                } else if (item.type === 'web' && item.endpoint && item.p256dh && item.auth) {
                    success = await retryWebPush(item)
                } else {
                    // Invalid item, drop it
                    stats.dropped++
                    await redis.lrem(RETRY_PROCESSING_KEY, 1, raw)
                    continue
                }
            } catch (error) {
                console.error(`[PushRetry] Retry attempt ${item.retryCount} failed for ${item.userId}:`, error)
            }

            // Remove from processing
            await redis.lrem(RETRY_PROCESSING_KEY, 1, raw)

            if (success) {
                stats.succeeded++
                // console.log(`[PushRetry] Retry succeeded for user ${item.userId} on attempt ${item.retryCount}`)
            } else {
                // Re-enqueue for next retry cycle
                await redis.lpush(RETRY_QUEUE_KEY, JSON.stringify(item))
            }
        }
    } catch (error) {
        console.error('[PushRetry] Queue processing error:', error)
    }

    if (stats.processed > 0) {
        // console.log(`[PushRetry] Processed: ${stats.processed}, Succeeded: ${stats.succeeded}, Dropped: ${stats.dropped}`)
    }

    return stats
}

/**
 * Retry an Expo push notification
 */
async function retryExpoPush(item: PushRetryItem): Promise<boolean> {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
            to: item.pushToken,
            title: item.title,
            body: item.body,
            data: item.data || {},
            sound: 'default',
        }])
    })

    if (!response.ok) return false

    const result = await response.json()
    const ticket = result.data?.[0]
    return ticket?.status === 'ok'
}

/**
 * Retry a Web Push notification
 */
async function retryWebPush(item: PushRetryItem): Promise<boolean> {
    try {
        const { sendPushNotification } = await import('./PushNotificationService')
        return await sendPushNotification(
            {
                endpoint: item.endpoint!,
                keys: { p256dh: item.p256dh!, auth: item.auth! },
            },
            {
                title: item.title,
                body: item.body,
                data: item.data as Record<string, unknown> | undefined,
            }
        )
    } catch {
        return false
    }
}

// Retry queue processor - starts a periodic check
let retryIntervalId: ReturnType<typeof setInterval> | null = null

export function startPushRetryProcessor(): void {
    if (retryIntervalId) return // Already running

    retryIntervalId = setInterval(async () => {
        try {
            await processRetryQueue()
        } catch (error) {
            console.error('[PushRetry] Processor error:', error)
        }
    }, RETRY_INTERVAL_MS)

    // console.log(`[PushRetry] Retry processor started (interval: ${RETRY_INTERVAL_MS / 1000}s)`)
}

export function stopPushRetryProcessor(): void {
    if (retryIntervalId) {
        clearInterval(retryIntervalId)
        retryIntervalId = null
        // console.log('[PushRetry] Retry processor stopped')
    }
}

/**
 * Get current stats of the retry queue
 */
export async function getRetryQueueStats(): Promise<{ queueLength: number; processingLength: number }> {
    try {
        const queueLength = await redis.llen(RETRY_QUEUE_KEY)
        const processingLength = await redis.llen(RETRY_PROCESSING_KEY)
        return { queueLength, processingLength }
    } catch (error) {
        console.error('[PushRetry] Failed to get queue stats:', error)
        return { queueLength: 0, processingLength: 0 }
    }
}
