import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  ensureAdminAccess: vi.fn(),
  findPayment: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({
  ensureAdminAccess: mockFns.ensureAdminAccess,
}))

vi.mock('@/lib/prisma-billing', () => ({
  prismaBilling: {
    payment: {
      findUnique: mockFns.findPayment,
    },
  },
}))

import { POST } from '@/app/api/admin/payments/verify-manual/route'

describe('admin verify-manual payment route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFns.ensureAdminAccess.mockResolvedValue(undefined)
    mockFns.findPayment.mockResolvedValue({
      id: 'pay-1',
      gatewayStatus: 'PENDING',
      invoiceId: 'inv-1',
      invoice: { pelangganId: 'cust-1', id: 'inv-1' },
    })
  })

  it('checks admin access before processing manual payment verification', async () => {
    await POST(new NextRequest('http://localhost/api/admin/payments/verify-manual', {
      method: 'POST',
      body: JSON.stringify({ paymentId: 'pay-1', action: 'REJECT' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(mockFns.ensureAdminAccess).toHaveBeenCalled()
  })
})
