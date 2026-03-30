import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('AttendancePageContent current status consumer', () => {
    it('uses the dedicated status endpoint while keeping history fetch for history data', () => {
        const content = readFileSync(
            join(process.cwd(), 'components', 'attendance', 'AttendancePageContent.tsx'),
            'utf8'
        )

        expect(content).toContain('/api/attendance/status')
        expect(content).toContain('/api/attendance/history?limit=5')
    })
})
