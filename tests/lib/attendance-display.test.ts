import { describe, expect, it } from 'vitest'

import { getDayOffDisplayLabel, getPermitDisplayLabel, hasAutoCheckoutNote, isHistoricalAutoCheckoutAbsence } from '@/lib/attendance-display'
import { ATTENDANCE_CONSTANTS } from '@/modules/attendance/utils/constants'

describe('attendance display semantics', () => {
  it('recognizes both legacy and canonical auto-checkout notes', () => {
    expect(hasAutoCheckoutNote('Auto checkout by system (Mangkir)')).toBe(true)
    expect(hasAutoCheckoutNote(ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE)).toBe(true)
    expect(hasAutoCheckoutNote('catatan lain')).toBe(false)
  })

  it('treats historical ALPHA/ABSENT rows with auto-checkout notes as no-checkout records', () => {
    expect(isHistoricalAutoCheckoutAbsence({
      status: 'ABSENT',
      checkOut: '2026-03-27T16:59:59.000Z',
      notes: 'Auto checkout by system (Mangkir)',
    })).toBe(true)

    expect(isHistoricalAutoCheckoutAbsence({
      status: 'ALPHA',
      checkOut: '2026-03-27T16:59:59.000Z',
      notes: ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
    })).toBe(true)

    expect(isHistoricalAutoCheckoutAbsence({
      status: 'ABSENT',
      checkOut: null,
      notes: 'Auto checkout by system (Mangkir)',
    })).toBe(false)
  })

  it('derives specific DAY_OFF labels from stored row notes', () => {
    expect(getDayOffDisplayLabel({
      status: 'DAY_OFF',
      notes: 'Auto-generated from Leave Request',
    })).toBe('Tukar Libur')

    expect(getDayOffDisplayLabel({
      status: 'DAY_OFF',
      notes: 'Hari Libur (Day Off) - Auto Generated',
    })).toBe('Libur Nasional')

    expect(getDayOffDisplayLabel({
      status: 'DAY_OFF',
      notes: 'Hari Off (Day Off) - Auto Generated',
    })).toBe('Hari Libur')
  })

  it('derives specific PERMIT labels from stored row notes', () => {
    expect(getPermitDisplayLabel({
      status: 'PERMIT',
      notes: 'Auto-generated from Leave Request (CUTI)',
    })).toBe('Cuti')

    expect(getPermitDisplayLabel({
      status: 'PERMIT',
      notes: 'Auto-generated from Leave Request (IZIN)',
    })).toBe('Izin')
  })
})
