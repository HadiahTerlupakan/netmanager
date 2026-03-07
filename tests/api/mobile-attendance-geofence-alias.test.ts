import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const APP_ROOT = process.cwd()
const aliasRoutePath = 'app/api/mobile/attendance/geofence/route.ts'

describe('mobile attendance geofence alias route', () => {
  it('provides an alias route for legacy mobile path', () => {
    const fullPath = join(APP_ROOT, aliasRoutePath)
    expect(existsSync(fullPath)).toBe(true)

    const content = readFileSync(fullPath, 'utf-8')
    expect(content).toContain("export { GET } from '@/app/api/mobile/geofence/route'")
  })
})
