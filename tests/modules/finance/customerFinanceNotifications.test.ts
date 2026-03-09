import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFns = vi.hoisted(() => ({
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}))

vi.mock('@/modules/notification/services/NotificationService', () => ({
  createNotification: mockFns.createNotification,
}))

import { notifyCustomerFinanceNotification } from '@/modules/finance/utils/customerFinanceNotifications'

describe('notifyCustomerFinanceNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips notification creation when customer has no linked user account', async () => {
    const result = await notifyCustomerFinanceNotification({
      userId: null,
      title: 'Tagihan Baru Tersedia',
      message: 'Tagihan Anda telah dibuat',
      link: '/tagihan',
      sourceType: 'INVOICE',
      sourceId: 'inv-1',
      priority: 'NORMAL',
    })

    expect(result).toBe(false)
    expect(mockFns.createNotification).not.toHaveBeenCalled()
  })

  it('creates notification when customer has a linked user account', async () => {
    const result = await notifyCustomerFinanceNotification({
      userId: 'user-1',
      title: 'Tagihan Baru Tersedia',
      message: 'Tagihan Anda telah dibuat',
      link: '/tagihan',
      sourceType: 'INVOICE',
      sourceId: 'inv-1',
      priority: 'NORMAL',
    })

    expect(result).toBe(true)
    expect(mockFns.createNotification).toHaveBeenCalledWith({
      type: 'SYSTEM',
      userId: 'user-1',
      title: 'Tagihan Baru Tersedia',
      message: 'Tagihan Anda telah dibuat',
      link: '/tagihan',
      sourceType: 'INVOICE',
      sourceId: 'inv-1',
      priority: 'NORMAL',
    })
  })
})
