import { describe, expect, it } from 'vitest'
import { normalizeKaryawanNotificationLink } from '@/lib/notifications/normalizeKaryawanNotificationLink'

describe('normalizeKaryawanNotificationLink', () => {
  it('maps admin work-order detail links to the existing karyawan work-order list', () => {
    expect(normalizeKaryawanNotificationLink('/admin/workorders/wo-1')).toBe('/karyawan/work-order')
    expect(normalizeKaryawanNotificationLink('/admin/work-order/wo-1')).toBe('/karyawan/work-order')
  })

  it('preserves non work-order links as-is', () => {
    expect(normalizeKaryawanNotificationLink('/karyawan/izin')).toBe('/karyawan/izin')
    expect(normalizeKaryawanNotificationLink('/admin/lembur')).toBe('/admin/lembur')
  })

  it('returns a safe fallback when link is missing', () => {
    expect(normalizeKaryawanNotificationLink(undefined)).toBe('#')
    expect(normalizeKaryawanNotificationLink(null)).toBe('#')
  })
})
