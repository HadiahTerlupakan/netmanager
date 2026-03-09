import { describe, expect, it } from 'vitest'

import {
  filterEligibleReminderRecipients,
  shouldSendRabReminder,
} from '@/lib/finance/rab-approval-reminder'

describe('rab approval reminder', () => {
  it('filters recipient who already approved or is creator', () => {
    const recipients = filterEligibleReminderRecipients({
      candidateApproverIds: ['u-1', 'u-2', 'u-3'],
      approvedUserIds: ['u-2'],
      creatorUserId: 'u-3',
    })

    expect(recipients).toEqual(['u-1'])
  })

  it('enforces cooldown window', () => {
    const now = new Date('2026-01-10T10:00:00.000Z')
    const recentReminder = new Date('2026-01-10T09:45:00.000Z')
    const staleReminder = new Date('2026-01-10T08:00:00.000Z')

    expect(shouldSendRabReminder({ now, lastReminderAt: recentReminder, cooldownMinutes: 30 })).toBe(false)
    expect(shouldSendRabReminder({ now, lastReminderAt: staleReminder, cooldownMinutes: 30 })).toBe(true)
    expect(shouldSendRabReminder({ now, lastReminderAt: null, cooldownMinutes: 30 })).toBe(true)
  })
})
