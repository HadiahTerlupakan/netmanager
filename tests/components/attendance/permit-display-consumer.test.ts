import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('AttendanceClient permit display consumer', () => {
  it('uses differentiated PERMIT labels from the shared helper', () => {
    const content = readFileSync(
      '/Users/rohadimraja/Documents/radpro/netmanager/app/admin/attendance/AttendanceClient.tsx',
      'utf8'
    )

    expect(content).toContain('getPermitDisplayLabel')
    expect(content).toContain("item.status === 'PERMIT'")
    expect(content).toContain('label: getPermitDisplayLabel(item)')
  })
})
