import type { MapSettings } from '@prisma/client'

export type MapSettingsFormState = {
  centerLat: string
  centerLng: string
  maxZoomIn: string
  maxZoomOut: string
  defaultZoom: string
}

export const buildMapSettingsFormState = (settings: MapSettings | null): MapSettingsFormState => ({
  centerLat: settings?.centerLat || '-6.2088',
  centerLng: settings?.centerLng || '106.8456',
  maxZoomIn: settings?.maxZoomIn || '22',
  maxZoomOut: settings?.maxZoomOut || '5',
  defaultZoom: settings?.defaultZoom || '13',
})
