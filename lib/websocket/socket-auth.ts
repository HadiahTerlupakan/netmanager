import type { IncomingHttpHeaders } from 'http'
import { getToken, decode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { verifyPelangganAccessToken } from '@/lib/jwt'
import type { SocketData } from './types'

interface ResolveSocketAuthInput {
    headers: IncomingHttpHeaders
    auth?: {
        token?: string
    }
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) return null
    const match = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function getBearerToken(headers: IncomingHttpHeaders, auth?: { token?: string }) {
    if (auth?.token) return auth.token
    const authorization = headers.authorization
    if (!authorization) return null
    const value = Array.isArray(authorization) ? authorization[0] : authorization
    if (!value?.startsWith('Bearer ')) return null
    return value.slice(7)
}

export async function resolveSocketAuth(input: ResolveSocketAuthInput): Promise<SocketData | null> {
    const bearerToken = getBearerToken(input.headers, input.auth)
    if (bearerToken) {
        console.log('[WS] Attempting mobile token auth...')
        const { verifyMobileToken } = await import('../mobile-auth')
        const mobileUser = await verifyMobileToken(bearerToken)
        if (mobileUser?.userId) {
            console.log(`[WS] Mobile auth success for user: ${mobileUser.userId}`)
            return {
                userId: mobileUser.userId,
                userRole: String(mobileUser.role || 'USER'),
                departmentId: typeof mobileUser.departmentId === 'string' ? mobileUser.departmentId : undefined,
                accessAdminPanel: Array.isArray(mobileUser.permissions)
                    ? mobileUser.permissions.includes('*') || mobileUser.permissions.includes('admin:read')
                    : false,
            }
        }
        console.warn('[WS] Mobile token verification failed')
    }

    const cookieHeader = Array.isArray(input.headers.cookie) ? input.headers.cookie.join('; ') : input.headers.cookie
    const customerToken = getCookieValue(cookieHeader, 'customer-token')
    if (customerToken) {
        const customer = await verifyPelangganAccessToken(customerToken)
        if (customer?.id && customer.status === 'AKTIF') {
            return {
                userId: customer.id,
                userRole: 'CUSTOMER',
                accessAdminPanel: false,
            }
        }
    }

    const isSecure = process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://')
    const cookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''

    let tokenSub = null

    try {
        // First try to extract the token string manually and decode it directly.
        // This avoids issues with NextAuth's internal req.cookies assumptions.
        const sessionToken = getCookieValue(cookieHeader, cookieName)
        if (sessionToken) {
            const decoded = await decode({ token: sessionToken, secret })
            if (decoded?.sub) {
                tokenSub = decoded.sub
            }
        }
    } catch (e) {
        console.warn('[WS] Failed to decode session token manually:', e)
    }

    if (!tokenSub) {
        // Fallback to NextAuth's getToken
        try {
            const token = await getToken({
                req: { headers: input.headers } as never,
                secret,
                cookieName,
                secureCookie: isSecure,
            })
            if (token?.sub) {
                tokenSub = token.sub
            }
        } catch (e) {
            console.warn('[WS] Fallback getToken failed:', e)
        }
    }

    if (!tokenSub) {
        console.error('[WS] Auth failed: no session token found in cookies (Names available:', cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]).join(', ') : 'none', ')')
        return null
    }

    const user = await prisma.user.findUnique({
        where: { id: tokenSub },
        select: {
            id: true,
            isActive: true,
            departmentId: true,
            role: {
                select: {
                    name: true,
                    accessAdminPanel: true,
                },
            },
        },
    })

    if (!user?.isActive) {
        return null
    }

    return {
        userId: user.id,
        userRole: user.role?.name || 'USER',
        departmentId: user.departmentId || undefined,
        accessAdminPanel: Boolean(user.role?.accessAdminPanel),
    }
}

export async function canJoinRoom(socketData: SocketData, room: string): Promise<boolean> {
    if (room.startsWith('user:')) {
        return room === `user:${socketData.userId}`
    }

    if (room.startsWith('admin:')) {
        return Boolean(socketData.accessAdminPanel)
    }

    if (room.startsWith('department:')) {
        return room === `department:${socketData.departmentId}`
    }

    if (room.startsWith('ticket:')) {
        const ticketId = room.slice('ticket:'.length)
        const ticket = await prisma.supportTickets.findUnique({
            where: { id: ticketId },
            select: { assignedToId: true, pelangganId: true },
        })
        if (!ticket) return false
        return Boolean(
            socketData.accessAdminPanel ||
            ticket.assignedToId === socketData.userId ||
            ticket.pelangganId === socketData.userId
        )
    }

    if (room.startsWith('workorder:')) {
        const workOrderId = room.slice('workorder:'.length)
        const workOrder = await prisma.workOrders.findUnique({
            where: { id: workOrderId },
            select: {
                assignedToId: true,
                createdById: true,
                requestedById: true,
                departmentId: true,
                pelangganId: true,
            },
        })
        if (!workOrder) return false
        return Boolean(
            socketData.accessAdminPanel ||
            workOrder.assignedToId === socketData.userId ||
            workOrder.createdById === socketData.userId ||
            workOrder.requestedById === socketData.userId ||
            workOrder.pelangganId === socketData.userId ||
            (socketData.departmentId && workOrder.departmentId === socketData.departmentId)
        )
    }

    if (room === 'chat:global') {
        return true
    }

    if (room.startsWith('chat:')) {
        const conversationId = room.slice('chat:'.length)
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: {
                isGlobal: true,
                participants: {
                    where: { userId: socketData.userId },
                    select: { userId: true },
                },
            },
        })
        if (!conversation) return false
        return conversation.isGlobal || conversation.participants.length > 0 || Boolean(socketData.accessAdminPanel)
    }

    return false
}
