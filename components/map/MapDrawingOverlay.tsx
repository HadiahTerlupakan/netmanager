import { Polyline } from 'react-leaflet'

type MapDrawingOverlayProps = {
  fiberLineMode: string
  fiberSourceNode: {
    latitude: number
    longitude: number
  } | null
  fiberWaypoints: [number, number][]
}

export function MapDrawingOverlay({ fiberLineMode, fiberSourceNode, fiberWaypoints }: MapDrawingOverlayProps) {
  if (fiberLineMode !== 'drawing' || !fiberSourceNode || fiberWaypoints.length === 0) {
    return null
  }

  return (
    <Polyline
      positions={[
        [fiberSourceNode.latitude, fiberSourceNode.longitude],
        ...fiberWaypoints,
      ]}
      pathOptions={{
        color: '#facc15',
        weight: 4,
        dashArray: '10, 10',
        opacity: 0.8,
      }}
    />
  )
}
