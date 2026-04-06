import { describe, expect, it } from 'vitest'

import {
  calculateMapDistance,
  determineFiberType,
  getConnectedDevices,
  getFiberColor,
} from '@/components/map/map-utils'

describe('map-utils', () => {
  it('calculates total map distance across waypoints', () => {
    const total = calculateMapDistance(-6.2, 106.8, -6.22, 106.82, [
      [-6.21, 106.81],
    ])

    expect(total).toBeGreaterThan(0)
    expect(total).toBe(Number(total.toFixed(1)))
  })

  it('classifies feeder links when either endpoint is server or olt', () => {
    expect(determineFiberType('server', 'odc')).toBe('feeder')
    expect(determineFiberType('odp', 'olt')).toBe('feeder')
  })

  it('classifies drop links when ont is involved and no feeder endpoint exists', () => {
    expect(determineFiberType('odp', 'ont')).toBe('drop')
  })

  it('classifies odp cascading links separately', () => {
    expect(determineFiberType('odp', 'odp')).toBe('odp_to_odp')
  })

  it('defaults remaining links to distribution', () => {
    expect(determineFiberType('odc', 'odp')).toBe('distribution')
    expect(determineFiberType('pole', 'joinbox')).toBe('distribution')
  })

  it('returns consistent fiber colors for known types and fallback', () => {
    expect(getFiberColor('feeder')).toBe('#c084fc')
    expect(getFiberColor('distribution')).toBe('#60a5fa')
    expect(getFiberColor('drop')).toBe('#4ade80')
    expect(getFiberColor('unknown')).toBe('#9ca3af')
  })

  it('derives connected device counts from edge direction', () => {
    const connected = getConnectedDevices('odc-1', [
      { source: 'odc-1', target: 'odp-1' },
      { source: 'odc-1', target: 'odp-2' },
      { source: 'server-1', target: 'odc-1' },
    ])

    expect(connected).toEqual({
      connectedTo: ['odp-1', 'odp-2'],
      connectedFrom: ['server-1'],
      usedSlots: 2,
    })
  })
})
