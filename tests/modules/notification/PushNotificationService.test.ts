import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prismaMock } from '../../setup'

const webPushMocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}))

vi.mock('web-push', () => ({
  default: webPushMocks,
}))

describe('PushNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
    process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  })

  it('deactivates invalid subscriptions that return 410', async () => {
    webPushMocks.sendNotification
      .mockRejectedValueOnce({ statusCode: 410, message: 'Gone' })
      .mockResolvedValueOnce(undefined)

    const { sendPushNotifications } = await import('@/modules/notification/services/PushNotificationService')

    const results = await sendPushNotifications([
      {
        endpoint: 'https://push.example/expired',
        keys: { p256dh: 'p1', auth: 'a1' },
      },
      {
        endpoint: 'https://push.example/active',
        keys: { p256dh: 'p2', auth: 'a2' },
      },
    ], {
      title: 'Hello',
      body: 'World',
    })

    expect(results).toEqual([
      { endpoint: 'https://push.example/expired', success: false },
      { endpoint: 'https://push.example/active', success: true },
    ])
    expect(prismaMock.pushSubscriptions.updateMany).toHaveBeenCalledWith({
      where: {
        endpoint: { in: ['https://push.example/expired'] },
      },
      data: {
        isActive: false,
      },
    })
  })
})
