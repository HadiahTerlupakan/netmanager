import { describe, expect, it } from 'vitest'

import {
  buildRabRevisionVarianceSummary,
  getVarianceLabel,
} from '@/modules/finance/rab-revision-variance'

describe('getVarianceLabel', () => {
  it('maps positive, negative, and zero variance to business labels', () => {
    expect(getVarianceLabel(15_000n)).toBe('UNTUNG')
    expect(getVarianceLabel(-1n)).toBe('RUGI')
    expect(getVarianceLabel(0n)).toBe('SESUAI')
  })
})

describe('buildRabRevisionVarianceSummary', () => {
  it('marks a project as untung when actual is below the final approved revision', () => {
    const result = buildRabRevisionVarianceSummary({
      originalCapex: 100_000n,
      originalOpex: 20_000n,
      finalCapex: 120_000n,
      finalOpex: 25_000n,
      actualCapex: 110_000n,
      actualOpex: 20_000n,
    })

    expect(result.originalTotal).toBe(120_000n)
    expect(result.finalTotal).toBe(145_000n)
    expect(result.actualTotal).toBe(130_000n)
    expect(result.netVariance).toBe(15_000n)
    expect(result.netLabel).toBe('UNTUNG')
    expect(result.capexVariance).toBe(10_000n)
    expect(result.opexVariance).toBe(5_000n)
  })

  it('marks a project as rugi when actual is above the final approved revision', () => {
    const result = buildRabRevisionVarianceSummary({
      originalCapex: 100_000n,
      originalOpex: 20_000n,
      finalCapex: 120_000n,
      finalOpex: 25_000n,
      actualCapex: 130_000n,
      actualOpex: 30_000n,
    })

    expect(result.netVariance).toBe(-15_000n)
    expect(result.netLabel).toBe('RUGI')
  })
})
