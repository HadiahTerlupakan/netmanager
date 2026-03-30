import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('AttendanceClient day off display consumer', () => {
  it('uses differentiated DAY_OFF labels instead of one generic Libur/Tukar Libur label', () => {
    const content = readFileSync(
      '/Users/rohadimraja/Documents/radpro/netmanager/app/admin/attendance/AttendanceClient.tsx',
      'utf8'
    )

    expect(content).toContain('getDayOffDisplayLabel')
    expect(content).toContain("item.status === 'DAY_OFF'")
    expect(content).toContain('label: getDayOffDisplayLabel(item)')
  })
})
