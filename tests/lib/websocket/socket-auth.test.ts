import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prismaMock } from '../../setup'

const mockGetToken = vi.hoisted(() => vi.fn())
const mockDecode = vi.hoisted(() => vi.fn())
const mockVerifyMobileToken = vi.hoisted(() => vi.fn())
const mockVerifyPelangganAccessToken = vi.hoisted(() => vi.fn())

vi.mock('next-auth/jwt', () => ({
  getToken: mockGetToken,
  decode: mockDecode,
}))

vi.mock('@/lib/mobile-auth', () => ({
  verifyMobileToken: mockVerifyMobileToken,
}))

vi.mock('@/lib/jwt', () => ({
  verifyPelangganAccessToken: mockVerifyPelangganAccessToken,
}))

import { canJoinRoom, resolveSocketAuth } from '@/lib/websocket/socket-auth'

describe('socket auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves authenticated web users from next-auth token and database', async () => {
    mockVerifyMobileToken.mockResolvedValue(null)
    mockGetToken.mockResolvedValue({ sub: 'user-1' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      isActive: true,
      departmentId: 'dept-1',
      role: { name: 'ADMIN', accessAdminPanel: true },
    })

    const result = await resolveSocketAuth({
      headers: { cookie: 'next-auth.session-token=abc' },
    })

    expect(result).toEqual({
      userId: 'user-1',
      userRole: 'ADMIN',
      departmentId: 'dept-1',
      accessAdminPanel: true,
    })
  })

  it('resolves authenticated customers from customer-token cookie', async () => {
    mockVerifyPelangganAccessToken.mockResolvedValueOnce({
      id: 'cust-1',
      status: 'AKTIF',
    })
    mockGetToken.mockResolvedValue(null)

    const result = await resolveSocketAuth({
      headers: { cookie: 'customer-token=customer-jwt' },
    })

    expect(result).toEqual({
      userId: 'cust-1',
      userRole: 'CUSTOMER',
      accessAdminPanel: false,
    })
  })

  it('blocks joining unrelated ticket rooms', async () => {
    prismaMock.supportTickets.findUnique.mockResolvedValueOnce({
      assignedToId: 'user-2',
      pelangganId: 'cust-2',
    })

    const allowed = await canJoinRoom({
      userId: 'user-1',
      userRole: 'EMPLOYEE',
      accessAdminPanel: false,
    }, 'ticket:ticket-1')

    expect(allowed).toBe(false)
  })

  it('allows joining related workorder rooms for assigned users', async () => {
    prismaMock.workOrders.findUnique.mockResolvedValueOnce({
      assignedToId: 'user-1',
      createdById: 'admin-1',
      requestedById: null,
      departmentId: 'dept-1',
      pelangganId: null,
    })

    const allowed = await canJoinRoom({
      userId: 'user-1',
      userRole: 'TEKNISI',
      departmentId: 'dept-2',
      accessAdminPanel: false,
    }, 'workorder:wo-1')

    expect(allowed).toBe(true)
  })

  it('blocks joining chat rooms without conversation membership', async () => {
    prismaMock.conversation.findUnique.mockResolvedValueOnce({
      isGlobal: false,
      participants: [],
    })

    const allowed = await canJoinRoom({
      userId: 'user-3',
      userRole: 'EMPLOYEE',
      accessAdminPanel: false,
    }, 'chat:conv-1')

    expect(allowed).toBe(false)
  })
})
