import { describe, expect, it } from 'vitest'

import { buildMapSettingsFormState } from '@/components/map/map-settings-utils'

describe('map-settings-utils', () => {
  it('builds settings form state from persisted settings', () => {
    expect(
      buildMapSettingsFormState({
        centerLat: '-6.1234',
        centerLng: '106.9876',
        maxZoomIn: '20',
        maxZoomOut: '4',
        defaultZoom: '12',
      })
    ).toEqual({
      centerLat: '-6.1234',
      centerLng: '106.9876',
      maxZoomIn: '20',
      maxZoomOut: '4',
      defaultZoom: '12',
    })
  })

  it('falls back to default map settings when persisted settings are missing', () => {
    expect(buildMapSettingsFormState(null)).toEqual({
      centerLat: '-6.2088',
      centerLng: '106.8456',
      maxZoomIn: '22',
      maxZoomOut: '5',
      defaultZoom: '13',
    })
  })
})
