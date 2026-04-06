import { describe, expect, it } from 'vitest'

import {
  buildFiberFormInitialState,
  getFiberTypeInfo,
} from '@/components/map/fiber-form-utils'

describe('fiber-form-utils', () => {
  it('builds initial form state from source and target names', () => {
    expect(
      buildFiberFormInitialState({
        sourceName: 'ODC-1',
        targetName: 'ODP-7',
        fiberType: 'drop',
      })
    ).toEqual({
      name: 'ODC-1 → ODP-7',
      fiberType: 'drop',
      notes: '',
    })
  })

  it('returns visual metadata for known fiber types and fallback', () => {
    expect(getFiberTypeInfo('feeder')).toEqual({
      color: 'text-purple-500',
      label: 'Purple line - Feeder network',
    })
    expect(getFiberTypeInfo('distribution')).toEqual({
      color: 'text-blue-500',
      label: 'Blue line - Distribution network',
    })
    expect(getFiberTypeInfo('drop')).toEqual({
      color: 'text-green-500',
      label: 'Green line - Drop network',
    })
    expect(getFiberTypeInfo('unknown')).toEqual({
      color: 'text-gray-500',
      label: 'Gray line - Standard connection',
    })
  })
})
