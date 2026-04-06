import type { DivIcon, Icon, IconOptions } from 'leaflet'
import { Marker, Popup } from 'react-leaflet'

type TempMarkerIcon = DivIcon | Icon<IconOptions>
type TempPosition = [number, number]

type MapTempMarkersProps = {
  serverActionMode: string
  odcActionMode: string
  odpActionMode: string
  ontActionMode: string
  poleActionMode: string
  joinboxActionMode: string
  serverTempPosition: TempPosition | null
  odcTempPosition: TempPosition | null
  odpTempPosition: TempPosition | null
  ontTempPosition: TempPosition | null
  poleTempPosition: TempPosition | null
  joinboxTempPosition: TempPosition | null
  setServerTempPosition: (position: TempPosition) => void
  setOdcTempPosition: (position: TempPosition) => void
  setOdpTempPosition: (position: TempPosition) => void
  setOntTempPosition: (position: TempPosition) => void
  setPoleTempPosition: (position: TempPosition) => void
  setJoinboxTempPosition: (position: TempPosition) => void
  createTempMarkerIcon: (type: string) => TempMarkerIcon
}

function renderTempPopup(title: string) {
  return (
    <Popup>
      <div className="text-sm">
        <p className="font-semibold mb-1">{title}</p>
        <p className="text-xs text-gray-600">Drag marker to adjust position</p>
      </div>
    </Popup>
  )
}

export function MapTempMarkers({
  serverActionMode,
  odcActionMode,
  odpActionMode,
  ontActionMode,
  poleActionMode,
  joinboxActionMode,
  serverTempPosition,
  odcTempPosition,
  odpTempPosition,
  ontTempPosition,
  poleTempPosition,
  joinboxTempPosition,
  setServerTempPosition,
  setOdcTempPosition,
  setOdpTempPosition,
  setOntTempPosition,
  setPoleTempPosition,
  setJoinboxTempPosition,
  createTempMarkerIcon,
}: MapTempMarkersProps) {
  return (
    <>
      {serverTempPosition && (
        <Marker
          position={serverTempPosition}
          icon={createTempMarkerIcon('olt')}
          draggable
          eventHandlers={{
            dragend: (e) => setServerTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold mb-1">{serverActionMode === 'adding' ? 'New Server Position' : 'Editing Position'}</p>
              <p className="text-xs text-gray-600">Drag marker to adjust position</p>
              <p className="text-xs text-gray-500 font-mono mt-1">
                {serverTempPosition[0].toFixed(6)}, {serverTempPosition[1].toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {odcTempPosition && (
        <Marker
          position={odcTempPosition}
          icon={createTempMarkerIcon('odc')}
          draggable
          eventHandlers={{
            dragend: (e) => setOdcTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
          }}
        >
          {renderTempPopup(odcActionMode === 'adding' ? 'New ODC Position' : 'Editing Position')}
        </Marker>
      )}

      {odpTempPosition && (
        <Marker
          position={odpTempPosition}
          icon={createTempMarkerIcon('odp')}
          draggable
          eventHandlers={{
            dragend: (e) => setOdpTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
          }}
        >
          {renderTempPopup(odpActionMode === 'adding' ? 'New ODP Position' : 'Editing Position')}
        </Marker>
      )}

      {ontTempPosition && (
        <Marker
          position={ontTempPosition}
          icon={createTempMarkerIcon('ont')}
          draggable
          eventHandlers={{
            dragend: (e) => setOntTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
          }}
        >
          {renderTempPopup(ontActionMode === 'adding' ? 'New ONT Position' : 'Editing Position')}
        </Marker>
      )}

      {poleTempPosition && (
        <Marker
          position={poleTempPosition}
          icon={createTempMarkerIcon('pole')}
          draggable
          eventHandlers={{
            dragend: (e) => setPoleTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
          }}
        >
          {renderTempPopup(poleActionMode === 'adding' ? 'New Pole Position' : 'Editing Position')}
        </Marker>
      )}

      {joinboxTempPosition && (
        <Marker
          position={joinboxTempPosition}
          icon={createTempMarkerIcon('joinbox')}
          draggable
          eventHandlers={{
            dragend: (e) => setJoinboxTempPosition([e.target.getLatLng().lat, e.target.getLatLng().lng]),
          }}
        >
          {renderTempPopup(joinboxActionMode === 'adding' ? 'New Joinbox Position' : 'Editing Position')}
        </Marker>
      )}
    </>
  )
}
