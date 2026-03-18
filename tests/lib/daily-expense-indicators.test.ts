import { describe, expect, it } from 'vitest'

import { buildDailyExpenseIndicators } from '@/modules/finance/daily-expense-indicators'

describe('daily expense indicators', () => {
  it('counts suspected duplicates based on stable composite key', () => {
    const indicators = buildDailyExpenseIndicators([
      {
        date: '2026-03-10T00:00:00.000Z',
        amount: '100000',
        category: 'OPEX',
        siteId: 'site-a',
        mixRadiusGroupId: null,
        description: 'Beli kabel dropcore',
        invoiceNumber: null,
        invoiceFile: null,
      },
      {
        date: '2026-03-10T10:00:00.000Z',
        amount: '100000',
        category: 'OPEX',
        siteId: 'site-a',
        mixRadiusGroupId: null,
        description: 'Beli kabel dropcore',
        invoiceNumber: null,
        invoiceFile: null,
      },
    ])

    expect(indicators.suspectedDuplicateCount).toBe(1)
  })

  it('counts pending verification when invoice number and file are both missing', () => {
    const indicators = buildDailyExpenseIndicators([
      {
        date: '2026-03-10T00:00:00.000Z',
        amount: '150000',
        category: 'CAPEX',
        siteId: null,
        mixRadiusGroupId: 'group-1',
        description: 'Install ODP',
        invoiceNumber: '',
        invoiceFile: '',
      },
      {
        date: '2026-03-10T00:00:00.000Z',
        amount: '250000',
        category: 'OPEX',
        siteId: null,
        mixRadiusGroupId: 'group-1',
        description: 'Sewa alat',
        invoiceNumber: 'INV-001',
        invoiceFile: '',
      },
    ])

    expect(indicators.pendingVerificationCount).toBe(1)
  })
})
