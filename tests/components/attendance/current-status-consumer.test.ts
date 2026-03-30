import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('AttendancePageContent current status consumer', () => {
    it('uses the dedicated status endpoint while keeping history fetch for history data', () => {
        const content = readFileSync(
            '/Users/rohadimraja/Documents/radpro/netmanager/components/attendance/AttendancePageContent.tsx',
            'utf8'
        )

        expect(content).toContain('/api/attendance/status')
        expect(content).toContain('/api/attendance/history?limit=5')
    })
})
