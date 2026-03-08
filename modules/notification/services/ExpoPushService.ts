import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'
import { enqueuePushRetry } from './PushRetryQueue'

interface ExpoPushMessage {
    to: string
    title: string
    body: string
    data?: Record<string, unknown>
    sound?: 'default' | null
    badge?: number
    channelId?: string
}

interface ExpoPushTicket {
    status: 'ok' | 'error'
    id?: string
    message?: string
    details?: unknown
}

interface FailedToken {
    token: string
    error: string
    details?: unknown
}

/**
 * Handle failed tokens by deleting invalid ones and enqueuing retries for others
 */
async function handleFailedTokens(failedTokens: FailedToken[], originalMessages: ExpoPushMessage[]) {
    // 1. Remove permanently invalid tokens
    const tokensToRemove = failedTokens.filter(f => f.error === 'DeviceNotRegistered').map(f => f.token)
    if (tokensToRemove.length > 0) {
        console.log(`[Push] Removing ${tokensToRemove.length} unregistered Expo push tokens`)
        await Promise.all([
            prisma.user.updateMany({ where: { pushToken: { in: tokensToRemove } }, data: { pushToken: null } }),
            prismaMitra.mitra.updateMany({ where: { pushToken: { in: tokensToRemove } }, data: { pushToken: null } }),
            prisma.pelanggan.updateMany({ where: { pushToken: { in: tokensToRemove } }, data: { pushToken: null } })
        ])
    }

    // 2. Retry retryable errors (e.g. RateExceeded, HTTP errors, etc.)
    const tokensToRetry = failedTokens.filter(f => f.error !== 'DeviceNotRegistered').map(f => f.token)
    
    if (tokensToRetry.length > 0) {
        // Need to find user IDs for the retry queue
        const [users, mitras, pelanggans] = await Promise.all([
            prisma.user.findMany({ where: { pushToken: { in: tokensToRetry } }, select: { id: true, pushToken: true } }),
            prismaMitra.mitra.findMany({ where: { pushToken: { in: tokensToRetry } }, select: { id: true, pushToken: true } }),
            prisma.pelanggan.findMany({ where: { pushToken: { in: tokensToRetry } }, select: { id: true, pushToken: true } })
        ])

        const tokenToUserId: Record<string, string> = {}
        users.forEach(u => tokenToUserId[u.pushToken!] = u.id)
        mitras.forEach(m => tokenToUserId[m.pushToken!] = m.id)
        pelanggans.forEach(p => tokenToUserId[p.pushToken!] = p.id)

        for (const token of tokensToRetry) {
            const msg = originalMessages.find(m => m.to === token)
            if (msg) {
                enqueuePushRetry({
                    type: 'expo',
                    userId: tokenToUserId[token] || 'unknown',
                    title: msg.title,
                    body: msg.body,
                    data: msg.data as Record<string, unknown>,
                    pushToken: token
                })
            }
        }
    }
}

/**
 * Send push notifications via Expo Push API
 * Includes throttling between chunks and per-ticket error handling
 */
async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ success: boolean, failedTokens: FailedToken[] }> {
    if (messages.length === 0) return { success: true, failedTokens: [] }

    // Expo recommends batching in chunks of 100
    const chunks: ExpoPushMessage[][] = []
    for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100))
    }

    let allSucceeded = true
    const failedTokens: FailedToken[] = []

    try {
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex]

            // Throttle: wait 200ms between chunks to avoid overwhelming Expo API
            if (chunkIndex > 0) {
                await new Promise(resolve => setTimeout(resolve, 200))
            }

            try {
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chunk)
                })

                if (!response.ok) {
                    console.error(`[Push] Expo API HTTP error ${response.status} for chunk ${chunkIndex + 1}/${chunks.length}`)
                    allSucceeded = false
                    chunk.forEach(msg => failedTokens.push({ token: msg.to, error: 'HTTP_ERROR' }))
                    continue
                }

                const result = await response.json()

                if (result.data) {
                    const tickets = result.data as ExpoPushTicket[]
                    tickets.forEach((ticket, index) => {
                        if (ticket.status === 'error') {
                            const errorType = ((ticket.details as Record<string, unknown>)?.error as string) || ticket.message || 'Unknown'
                            failedTokens.push({
                                token: chunk[index].to,
                                error: errorType,
                                details: ticket.details
                            })
                        }
                    })
                }
            } catch (chunkError) {
                console.error(`[Push] Failed to send chunk ${chunkIndex + 1}/${chunks.length}:`, chunkError)
                allSucceeded = false
                chunk.forEach(msg => failedTokens.push({ token: msg.to, error: 'NETWORK_ERROR' }))
                // Continue with next chunk instead of aborting all
            }
        }
        return { success: allSucceeded, failedTokens }
    } catch (error) {
        console.error('[Push] Expo API error:', error)
        return { success: false, failedTokens: messages.map(m => ({ token: m.to, error: 'CRITICAL_ERROR' })) }
    }
}

/**
 * Send push notification to a specific user via Expo Push API
 */
export async function sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<boolean> {
    try {
        // Get user's push token
        let pushToken: string | null = null;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushToken: true }
        })
        pushToken = user?.pushToken || null;

        // Fallback to checking Mitra table
        if (!pushToken) {
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: userId },
                select: { pushToken: true }
            })
            pushToken = mitra?.pushToken || null;
        }

        if (!pushToken) {
            return false
        }

        const messages: ExpoPushMessage[] = [{
            to: pushToken,
            title,
            body,
            data: data || {},
            sound: 'default'
        }]

        const { success, failedTokens } = await sendExpoPush(messages)
        if (!success && failedTokens.length > 0) {
            await handleFailedTokens(failedTokens, messages)
        }
        return success

    } catch (error) {
        console.error('[Push] Error sending notification:', error)
        return false
    }
}

/**
 * Send push notification to a specific customer via Expo Push API
 */
export async function sendCustomerPushNotification(
    pelangganId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<boolean> {
    try {
        // Get customer's push token
        const pelanggan = await prisma.pelanggan.findUnique({
            where: { id: pelangganId },
            select: { pushToken: true }
        })

        if (!pelanggan?.pushToken) {
            return false
        }

        const messages: ExpoPushMessage[] = [{
            to: pelanggan.pushToken,
            title,
            body,
            data: data || {},
            sound: 'default'
        }]

        const { success, failedTokens } = await sendExpoPush(messages)
        if (!success && failedTokens.length > 0) {
            await handleFailedTokens(failedTokens, messages)
        }
        return success

    } catch (error) {
        console.error('[Push] Error sending customer notification:', error)
        return false
    }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<number> {
    try {
        // Get all users' push tokens
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                pushToken: { not: null }
            },
            select: { id: true, pushToken: true }
        })

        const foundUserIds = users.map(u => u.id);
        const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));
        let mitras: { id: string, pushToken: string | null }[] = [];

        if (missingUserIds.length > 0) {
            mitras = await prismaMitra.mitra.findMany({
                where: {
                    id: { in: missingUserIds },
                    pushToken: { not: null }
                },
                select: { id: true, pushToken: true }
            })
        }

        const allTokens = [
            ...users.map(u => u.pushToken!),
            ...mitras.map(m => m.pushToken!)
        ].filter(Boolean); // Ensure no nulls

        if (allTokens.length === 0) {
            return 0
        }

        const messages: ExpoPushMessage[] = allTokens.map(token => ({
            to: token,
            title,
            body,
            data: data || {},
            sound: 'default'
        }))

        const { success, failedTokens } = await sendExpoPush(messages)
        if (!success && failedTokens.length > 0) {
            await handleFailedTokens(failedTokens, messages)
        }
        return allTokens.length - failedTokens.length
    } catch (error) {
        console.error('[Push] Error sending notifications:', error)
        return 0
    }
}

/**
 * Convenience function to send push when creating notifications
 * Call this after createNotification() in your services
 */
export async function sendPushForNotification(
    userId: string,
    title: string,
    message: string,
    link?: string,
    sourceType?: string,
    sourceId?: string
): Promise<void> {
    await sendPushNotification(userId, title, message, {
        link,
        sourceType,
        sourceId
    })
}

/**
 * Send push notification to all users in a department
 */
export async function sendPushToDepartment(
    departmentId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<number> {
    try {
        // Get all users in department with push tokens
        const users = await prisma.user.findMany({
            where: {
                departmentId,
                isActive: true,
                pushToken: { not: null }
            },
            select: { id: true, pushToken: true }
        })

        if (users.length === 0) {
            return 0
        }

        const messages: ExpoPushMessage[] = users.map(user => ({
            to: user.pushToken!,
            title,
            body,
            data: data || {},
            sound: 'default'
        }))

        const { success, failedTokens } = await sendExpoPush(messages)
        if (!success && failedTokens.length > 0) {
            await handleFailedTokens(failedTokens, messages)
        }
        return users.length - failedTokens.length
    } catch (error) {
        console.error('[Push] Error sending to department:', error)
        return 0
    }
}
