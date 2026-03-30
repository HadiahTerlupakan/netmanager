import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('AttendanceClient permit display consumer', () => {
  it('uses differentiated PERMIT labels from the shared helper', () => {
    const content = readFileSync(
      join(process.cwd(), 'app', 'admin', 'attendance', 'AttendanceClient.tsx'),
      'utf8'
    )

    expect(content).toContain('getPermitDisplayLabel')
    expect(content).toContain("item.status === 'PERMIT'")
    expect(content).toContain('label: getPermitDisplayLabel(item)')
  })
})
