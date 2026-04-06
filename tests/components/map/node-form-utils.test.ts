import { describe, expect, it } from 'vitest'

import {
  getNodeTypeLabel,
  getNodeSplitterOptions,
} from '@/components/map/node-form-utils'

describe('node-form-utils', () => {
  it('returns readable labels for known node types', () => {
    expect(getNodeTypeLabel('server')).toBe('Server')
    expect(getNodeTypeLabel('olt')).toBe('Server')
    expect(getNodeTypeLabel('odc')).toBe('ODC')
    expect(getNodeTypeLabel('odp')).toBe('ODP')
    expect(getNodeTypeLabel('ont')).toBe('ONT')
  })

  it('falls back to uppercase for unknown node types', () => {
    expect(getNodeTypeLabel('joinbox')).toBe('JOINBOX')
  })

  it('returns broader splitter choices for ODC and narrower ones for ODP', () => {
    expect(getNodeSplitterOptions('odc')).toEqual(['1:2', '1:4', '1:8', '1:16', '1:32', '1:64'])
    expect(getNodeSplitterOptions('odp')).toEqual(['1:2', '1:4', '1:8', '1:16', '1:32'])
    expect(getNodeSplitterOptions('ont')).toEqual([])
  })
})
