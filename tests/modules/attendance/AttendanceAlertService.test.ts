import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prismaMock } from '../../setup'

const mockFns = vi.hoisted(() => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
}))

const redisStore = new Map<string, { value: string; expiresAt: number }>()

vi.mock('@/modules/notification/services/ExpoPushService', () => ({
  sendPushNotification: mockFns.sendPushNotification,
}))

vi.mock('@/modules/notification/services/NotificationService', () => ({
  createNotification: mockFns.createNotification,
}))

vi.mock('@/lib/redis', () => {
  const get = vi.fn(async (key: string) => {
    const entry = redisStore.get(key)
    if (!entry || entry.expiresAt <= Date.now()) {
      redisStore.delete(key)
      return null
    }
    return entry.value
  })

  const set = vi.fn(async (key: string, value: string, mode?: string, ttlSeconds?: number, nxMode?: string) => {
    const ttl = typeof ttlSeconds === 'number' ? ttlSeconds : 3600
    const now = Date.now()
    const existing = redisStore.get(key)
    const canWrite = !(mode === 'EX' && nxMode === 'NX' && existing && existing.expiresAt > now)
    if (!canWrite) return null

    redisStore.set(key, { value, expiresAt: now + ttl * 1000 })
    return 'OK'
  })

  return { redis: { get, set } }
})

import {
  processCheckInReminders,
  processIncompleteAttendance,
  processFlexibleReminders,
} from '@/modules/attendance/services/AttendanceAlertService'

describe('AttendanceAlertService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 9, 8, 35, 0, 0))
    vi.clearAllMocks()
    redisStore.clear()
  })

  it('sends check-in reminders only once per user within the same reminder window', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        name: 'Budi',
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workDays: 'MON,TUE,WED,THU,FRI',
        pushToken: 'token-1',
      },
    ])
    prismaMock.attendance.findMany.mockResolvedValue([])

    const first = await processCheckInReminders(30)
    const second = await processCheckInReminders(30)

    expect(first.usersNotified).toBe(1)
    expect(second.usersNotified).toBe(0)
    expect(mockFns.sendPushNotification).toHaveBeenCalledTimes(1)
  })

  it('sends flexible reminders once per exceeded hour bucket', async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        checkIn: new Date(2026, 2, 8, 23, 20, 0, 0),
        user: {
          id: 'user-flex',
          name: 'Sari',
          flexibleTargetHour: 8,
          pushToken: 'token-flex',
        },
      },
    ])

    const first = await processFlexibleReminders()
    const second = await processFlexibleReminders()

    expect(first.usersNotified).toBe(1)
    expect(second.usersNotified).toBe(0)
    expect(mockFns.sendPushNotification).toHaveBeenCalledTimes(1)
  })

  it('creates incomplete attendance alerts only once per user per day', async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        userId: 'user-miss',
        user: { name: 'Rina' },
      },
    ])

    const first = await processIncompleteAttendance()
    const second = await processIncompleteAttendance()

    expect(first.usersNotified).toEqual(['Rina'])
    expect(second.usersNotified).toEqual([])
    expect(mockFns.createNotification).toHaveBeenCalledTimes(1)
  })
})
