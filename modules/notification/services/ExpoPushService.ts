import { UserRepository } from '@/modules/users/repositories/UserRepository'
import { PelangganRepository } from '@/modules/pelanggan/repositories/PelangganRepository'
import { MitraRepository } from '@/modules/mitra/repositories/MitraRepository'
import { enqueuePushRetry } from './PushRetryQueue'

const userRepo = new UserRepository()
const pelangganRepo = new PelangganRepository()
const mitraRepo = new MitraRepository()

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

interface PushTokenRecord {
    id: string
    pushToken: string | null
}

async function clearPushTokensInMitra(tokens: string[]) {
    await mitraRepo.clearPushTokens(tokens)
}

async function findUsersByPushTokens(tokens: string[]): Promise<PushTokenRecord[]> {
    return userRepo.findManyWithPushToken(tokens)
}

async function findMitrasByPushTokens(tokens: string[]): Promise<PushTokenRecord[]> {
    return mitraRepo.findManyWithPushToken(tokens)
}

async function findPelangganByPushTokens(tokens: string[]): Promise<PushTokenRecord[]> {
    return pelangganRepo.findManyWithPushToken(tokens)
}

async function handleFailedTokens(failedTokens: FailedToken[], originalMessages: ExpoPushMessage[]) {
    const tokensToRemove = failedTokens.filter(f => f.error === 'DeviceNotRegistered').map(f => f.token)
    if (tokensToRemove.length > 0) {
        console.log(`[Push] Removing ${tokensToRemove.length} unregistered Expo push tokens`)
        await Promise.all([
            userRepo.clearPushTokens(tokensToRemove),
            clearPushTokensInMitra(tokensToRemove),
            pelangganRepo.clearPushTokens(tokensToRemove)
        ])
    }

    const tokensToRetry = failedTokens.filter(f => f.error !== 'DeviceNotRegistered').map(f => f.token)
    
    if (tokensToRetry.length > 0) {
        const [users, mitras, pelanggans] = await Promise.all([
            findUsersByPushTokens(tokensToRetry),
            findMitrasByPushTokens(tokensToRetry),
            findPelangganByPushTokens(tokensToRetry)
        ])

        const tokenToUserId: Record<string, string> = {}
        for (const u of users) { if (u.pushToken) tokenToUserId[u.pushToken] = u.id }
        for (const m of mitras) { if (m.pushToken) tokenToUserId[m.pushToken] = m.id }
        for (const p of pelanggans) { if (p.pushToken) tokenToUserId[p.pushToken] = p.id }

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

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ success: boolean, failedTokens: FailedToken[] }> {
    if (messages.length === 0) return { success: true, failedTokens: [] }

    const chunks: ExpoPushMessage[][] = []
    for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100))
    }

    let allSucceeded = true
    const failedTokens: FailedToken[] = []

    try {
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex]

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
                    for (const msg of chunk) {
                        failedTokens.push({ token: msg.to, error: 'HTTP_ERROR' })
                    }
                    continue
                }

                const result = await response.json()

                if (result.data) {
                    const tickets = result.data as ExpoPushTicket[]
                    for (let i = 0; i < tickets.length; i++) {
                        const ticket = tickets[i]
                        if (ticket.status === 'error') {
                            const errorType = ((ticket.details as Record<string, unknown>)?.error as string) || ticket.message || 'Unknown'
                            failedTokens.push({
                                token: chunk[i].to,
                                error: errorType,
                                details: ticket.details
                            })
                        }
                    }
                }
            } catch (chunkError) {
                console.error(`[Push] Failed to send chunk ${chunkIndex + 1}/${chunks.length}:`, chunkError)
                allSucceeded = false
                for (const msg of chunk) {
                    failedTokens.push({ token: msg.to, error: 'NETWORK_ERROR' })
                }
            }
        }
        return { success: allSucceeded, failedTokens }
    } catch (error) {
        console.error('[Push] Expo API error:', error)
        return { success: false, failedTokens: messages.map(m => ({ token: m.to, error: 'CRITICAL_ERROR' })) }
    }
}

export async function sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<boolean> {
    try {
        let pushToken: string | null = null;

        const user = await userRepo.findByIdWithPushToken(userId)
        pushToken = user?.pushToken || null;

        if (!pushToken) {
            const mitra = await mitraRepo.findPushTokenById(userId)
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

export async function sendCustomerPushNotification(
    pelangganId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<boolean> {
    try {
        const pelanggan = await pelangganRepo.findByIdWithPushToken(pelangganId)

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

export async function sendPushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<number> {
    try {
        const users = await userRepo.findManyWithPushTokenAndFilter(userIds)

        const foundUserIds = users.map(u => u.id);
        const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));
        let mitras: { id: string, pushToken: string | null }[] = [];

        if (missingUserIds.length > 0) {
            mitras = await mitraRepo.findManyWithPushTokenByIds(missingUserIds)
        }

        const allTokens: string[] = []
        for (const u of users) { if (u.pushToken) allTokens.push(u.pushToken) }
        for (const m of mitras) { if (m.pushToken) allTokens.push(m.pushToken) }

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

export async function sendPushToDepartment(
    departmentId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
): Promise<number> {
    try {
        const users = await userRepo.findManyByDepartmentWithPushToken(departmentId)

        if (users.length === 0) {
            return 0
        }

        const messages: ExpoPushMessage[] = users.map((user: { id: string; pushToken: string | null }) => ({
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
