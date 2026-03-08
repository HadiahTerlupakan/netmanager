import { describe, expect, it, vi } from 'vitest'

import { recoverPushSubscription } from '@/worker/pushSubscriptionRecovery'

describe('recoverPushSubscription', () => {
  it('re-subscribes and syncs the recovered subscription to the backend', async () => {
    const subscribe = vi.fn().mockResolvedValue({
      endpoint: 'https://push.example/new-sub',
      toJSON: () => ({
        endpoint: 'https://push.example/new-sub',
        keys: { p256dh: 'p-key', auth: 'a-key' },
      }),
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })

    await recoverPushSubscription({
      vapidPublicKey: 'test-public-key',
      subscribe,
      fetchImpl: fetchMock,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })

    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/subscribe', expect.objectContaining({
      method: 'POST',
    }))
  })
})
