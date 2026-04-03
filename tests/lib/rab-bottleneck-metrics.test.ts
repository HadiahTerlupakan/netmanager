import { describe, expect, it } from 'vitest'

import { buildRabBottleneckMetrics } from '@/modules/finance/utils/rab-bottleneck-metrics'

describe('rab bottleneck metrics', () => {
  it('computes pending count and oldest pending age days', () => {
    const now = new Date('2026-01-10T12:00:00.000Z')
    const metrics = buildRabBottleneckMetrics({
      now,
      projects: [
        { id: 'rab-1', name: 'A', status: 'PENDING_APPROVAL', createdAt: new Date('2026-01-05T00:00:00.000Z') },
        { id: 'rab-2', name: 'B', status: 'PENDING_APPROVAL', createdAt: new Date('2026-01-08T00:00:00.000Z') },
        { id: 'rab-3', name: 'C', status: 'APPROVED', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      ],
      approvals: [],
    })

    expect(metrics.pendingApprovalCount).toBe(2)
    expect(metrics.oldestPendingDays).toBe(5)
    expect(metrics.oldestPendingProjectName).toBe('A')
  })

  it('computes average approval lead time in hours', () => {
    const metrics = buildRabBottleneckMetrics({
      now: new Date('2026-01-10T12:00:00.000Z'),
      projects: [
        { id: 'rab-1', name: 'A', status: 'APPROVED', createdAt: new Date('2026-01-10T00:00:00.000Z') },
        { id: 'rab-2', name: 'B', status: 'APPROVED', createdAt: new Date('2026-01-10T00:00:00.000Z') },
      ],
      approvals: [
        { rabProjectId: 'rab-1', createdAt: new Date('2026-01-10T04:00:00.000Z') },
        { rabProjectId: 'rab-2', createdAt: new Date('2026-01-10T06:00:00.000Z') },
      ],
    })

    expect(metrics.averageApprovalLeadHours).toBe(5)
  })
})
