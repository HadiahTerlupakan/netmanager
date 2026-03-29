import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFns = vi.hoisted(() => ({
  processCheckInReminders: vi.fn(),
  processCheckOutReminders: vi.fn(),
  processIncompleteAttendance: vi.fn(),
  runScheduledAttendanceCheck: vi.fn(),
  acquireCronLock: vi.fn(),
}))

vi.mock('@/lib/cron-lock', () => ({
  acquireCronLock: mockFns.acquireCronLock,
}))

vi.mock('@/modules/attendance/services/AttendanceAlertService', () => ({
  processCheckInReminders: mockFns.processCheckInReminders,
  processCheckOutReminders: mockFns.processCheckOutReminders,
  processIncompleteAttendance: mockFns.processIncompleteAttendance,
  runScheduledAttendanceCheck: mockFns.runScheduledAttendanceCheck,
}))

import { GET } from '@/app/api/cron/attendance-alert/route'

describe('attendance-alert cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
  })

  it('returns a skip response when the attendance-alert lock is already held', async () => {
    mockFns.acquireCronLock.mockResolvedValue(false)

    const response = await GET(new NextRequest('http://localhost/api/cron/attendance-alert?type=auto', {
      headers: { authorization: 'Bearer cron-secret' },
    }))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.data.skipped).toBe(true)
    expect(json.data.reason).toBe('Lock already held')
    expect(json.data.type).toBe('auto')
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith('route:attendanceAlert:auto', 10 * 60)
    expect(mockFns.runScheduledAttendanceCheck).not.toHaveBeenCalled()
  })

  it('uses the process-specific lock configuration', async () => {
    mockFns.acquireCronLock.mockResolvedValue(false)

    const response = await GET(new NextRequest('http://localhost/api/cron/attendance-alert?type=process', {
      headers: { authorization: 'Bearer cron-secret' },
    }))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.data.type).toBe('process')
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith('route:attendanceAlert:process', 60 * 60)
    expect(mockFns.processIncompleteAttendance).not.toHaveBeenCalled()
  })
})
