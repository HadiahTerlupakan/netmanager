import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const capturedPolylines: Array<Record<string, unknown>> = []
const capturedMarkers: Array<Record<string, unknown>> = []

vi.mock('react-leaflet', async () => {
  const React = await import('react')

  return {
    Polyline: (props: Record<string, unknown>) => {
      capturedPolylines.push(props)
      return React.createElement('mock-polyline', props, props.children as React.ReactNode)
    },
    Marker: (props: Record<string, unknown>) => {
      capturedMarkers.push(props)
      return React.createElement('mock-marker', props, props.children as React.ReactNode)
    },
    Popup: (props: Record<string, unknown>) => React.createElement('mock-popup', props, props.children as React.ReactNode),
  }
})

beforeEach(() => {
  capturedPolylines.length = 0
  capturedMarkers.length = 0
})

describe('MapDrawingOverlay', () => {
  it('renders the fiber preview polyline with the expected style and waypoints', async () => {
    const { MapDrawingOverlay } = await import('@/components/map/MapDrawingOverlay')

    const markup = renderToStaticMarkup(
      React.createElement(MapDrawingOverlay, {
        fiberLineMode: 'drawing',
        fiberSourceNode: { latitude: -6.2, longitude: 106.8 },
        fiberWaypoints: [
          [-6.21, 106.81],
          [-6.22, 106.82],
        ],
      })
    )

    expect(markup).toContain('mock-polyline')
    expect(capturedPolylines).toHaveLength(1)
    expect(capturedPolylines[0]).toMatchObject({
      positions: [
        [-6.2, 106.8],
        [-6.21, 106.81],
        [-6.22, 106.82],
      ],
      pathOptions: {
        color: '#facc15',
        weight: 4,
        dashArray: '10, 10',
        opacity: 0.8,
      },
    })
  })
})

describe('MapTempMarkers', () => {
  it('renders every temp marker variant with the expected popup copy and drag handlers', async () => {
    const { MapTempMarkers } = await import('@/components/map/MapTempMarkers')
    const createTempMarkerIcon = vi.fn((type: string) => ({ type: 'icon', markerType: type }))
    const setServerTempPosition = vi.fn()
    const setOdcTempPosition = vi.fn()
    const setOdpTempPosition = vi.fn()
    const setOntTempPosition = vi.fn()
    const setPoleTempPosition = vi.fn()
    const setJoinboxTempPosition = vi.fn()

    const markup = renderToStaticMarkup(
      React.createElement(MapTempMarkers, {
        serverActionMode: 'adding',
        odcActionMode: 'editing',
        odpActionMode: 'adding',
        ontActionMode: 'editing',
        poleActionMode: 'adding',
        joinboxActionMode: 'editing',
        serverTempPosition: [-6.2, 106.8],
        odcTempPosition: [-6.21, 106.81],
        odpTempPosition: [-6.22, 106.82],
        ontTempPosition: [-6.23, 106.83],
        poleTempPosition: [-6.24, 106.84],
        joinboxTempPosition: [-6.25, 106.85],
        setServerTempPosition,
        setOdcTempPosition,
        setOdpTempPosition,
        setOntTempPosition,
        setPoleTempPosition,
        setJoinboxTempPosition,
        createTempMarkerIcon,
      })
    )

    expect(markup).toContain('New Server Position')
    expect(markup).toContain('Editing Position')
    expect(markup).toContain('New ODP Position')
    expect(markup).toContain('New Pole Position')
    expect(markup).toContain('Drag marker to adjust position')
    expect(markup).toContain('-6.200000, 106.800000')
    expect(markup).not.toContain('-6.22, 106.82')
    expect(markup).not.toContain('-6.25, 106.85')
    expect(markup).toContain('New Server Position')
    expect(markup).toContain('Editing Position')
    expect(markup).toContain('New ODP Position')
    expect(markup).toContain('New Pole Position')
    expect(markup).toContain('Editing Position')
    expect(capturedMarkers[5]).toMatchObject({
      position: [-6.25, 106.85],
      draggable: true,
    })
    expect(createTempMarkerIcon.mock.calls[5][0]).toBe('joinbox')

    expect(markup).not.toContain('New Joinbox Position')

    expect(markup).toContain('Drag marker to adjust position')
    expect(markup).toContain('-6.200000, 106.800000')

    expect(capturedMarkers).toHaveLength(6)
    expect(createTempMarkerIcon).toHaveBeenCalledTimes(6)
    expect(createTempMarkerIcon.mock.calls.map((call) => call[0])).toEqual([
      'olt',
      'odc',
      'odp',
      'ont',
      'pole',
      'joinbox',
    ])

    const [serverMarker, odcMarker, odpMarker, ontMarker, poleMarker, joinboxMarker] = capturedMarkers
    ;(serverMarker.eventHandlers as { dragend: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({
      target: { getLatLng: () => ({ lat: -6.26, lng: 106.86 }) },
    })
    ;(odcMarker.eventHandlers as { dragend: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({
      target: { getLatLng: () => ({ lat: -6.27, lng: 106.87 }) },
    })
    ;(odpMarker.eventHandlers as { dragend: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({
      target: { getLatLng: () => ({ lat: -6.28, lng: 106.88 }) },
    })
    ;(ontMarker.eventHandlers as { dragend: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({
      target: { getLatLng: () => ({ lat: -6.29, lng: 106.89 }) },
    })
    ;(poleMarker.eventHandlers as { dragend: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({
      target: { getLatLng: () => ({ lat: -6.3, lng: 106.9 }) },
    })
    ;(joinboxMarker.eventHandlers as { dragend: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void }).dragend({
      target: { getLatLng: () => ({ lat: -6.31, lng: 106.91 }) },
    })

    expect(setServerTempPosition).toHaveBeenCalledWith([-6.26, 106.86])
    expect(setOdcTempPosition).toHaveBeenCalledWith([-6.27, 106.87])
    expect(setOdpTempPosition).toHaveBeenCalledWith([-6.28, 106.88])
    expect(setOntTempPosition).toHaveBeenCalledWith([-6.29, 106.89])
    expect(setPoleTempPosition).toHaveBeenCalledWith([-6.3, 106.9])
    expect(setJoinboxTempPosition).toHaveBeenCalledWith([-6.31, 106.91])
  })
})

describe('MapFiberLinesLayer', () => {
  it('renders fiber lines with the expected popup details', async () => {
    const { MapFiberLinesLayer } = await import('@/components/map/MapFiberLinesLayer')

    const markup = renderToStaticMarkup(
      React.createElement(MapFiberLinesLayer, {
        edges: [
          {
            edgeId: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            fiberType: 'distribution',
            waypoints: JSON.stringify([[-6.21, 106.81]]),
          },
        ],
        nodes: [
          {
            nodeId: 'node-1',
            name: 'ODC Alpha',
            latitude: -6.2,
            longitude: 106.8,
          },
          {
            nodeId: 'node-2',
            name: 'ODP Beta',
            latitude: -6.22,
            longitude: 106.82,
          },
        ],
        onDeleteEdge: vi.fn(),
      })
    )

    expect(markup).toContain('mock-polyline')
    expect(markup).toContain('Fiber Line')
    expect(markup).toContain('ODC Alpha')
    expect(markup).toContain('ODP Beta')
    expect(markup).toContain('Delete Fiber Line')
    expect(markup).toContain('Distance:')
    expect(capturedPolylines).toHaveLength(1)
    expect(capturedPolylines[0]).toMatchObject({
      positions: [
        [-6.2, 106.8],
        [-6.21, 106.81],
        [-6.22, 106.82],
      ],
      pathOptions: {
        color: '#60a5fa',
        weight: 6,
        opacity: 0.9,
        dashArray: '10, 15',
        className: 'animated-polyline',
      },
    })
  })
})

describe('MapFiberDrawingInfoPanel', () => {
  it('renders drawing source, waypoint count, and distance summary', async () => {
    const { MapFiberDrawingInfoPanel } = await import('@/components/map/MapFiberDrawingInfoPanel')

    const markup = renderToStaticMarkup(
      React.createElement(MapFiberDrawingInfoPanel, {
        fiberLineMode: 'drawing',
        fiberSourceNode: {
          name: 'ODC Alpha',
          latitude: -6.2,
          longitude: 106.8,
        },
        fiberWaypoints: [
          [-6.21, 106.81],
          [-6.22, 106.82],
        ],
      })
    )

    expect(markup).toContain('Drawing Fiber Line')
    expect(markup).toContain('Source:')
    expect(markup).toContain('ODC Alpha')
    expect(markup).toContain('Click target node')
    expect(markup).toContain('Waypoints:')
    expect(markup).toContain('2')
    expect(markup).toContain('Distance:')
    expect(markup).toContain('3135.9 m')
  })
})
