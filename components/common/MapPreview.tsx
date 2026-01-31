"use client"

import { useEffect, useRef } from 'react'
import 'ol/ol.css'

type MapPreviewProps = {
  lat?: number | null
  lon?: number | null
  height?: number
}

export default function MapPreview({ lat, lon, height = 240 }: MapPreviewProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('ol').Map | null>(null)
  const markerLayerRef = useRef<import('ol/layer/Vector').default<import('ol/source/Vector').default> | null>(null)

  useEffect(() => {
    let cleanup = () => { }
      ; (async () => {
        if (!mapEl.current) return

        const { Map, View } = await import('ol')
        const { default: OSM } = await import('ol/source/OSM')
        const { default: TileLayer } = await import('ol/layer/Tile')
        const { default: VectorLayer } = await import('ol/layer/Vector')
        const { default: VectorSource } = await import('ol/source/Vector')
        const { fromLonLat } = await import('ol/proj')
        const { default: Feature } = await import('ol/Feature')
        const { default: Point } = await import('ol/geom/Point')
        const { Style, Fill, Stroke } = await import('ol/style')
        const { default: CircleStyle } = await import('ol/style/Circle')
        const { defaults: defaultControls, Zoom, Attribution } = await import('ol/control')

        const centerLonLat: [number, number] = [
          typeof lon === 'number' ? lon : 106.816666,
          typeof lat === 'number' ? lat : -6.2,
        ]
        const center3857 = fromLonLat(centerLonLat)

        const tile = new TileLayer({ source: new OSM() })
        const markerSource = new VectorSource()
        const marker = new VectorLayer({ source: markerSource })
        markerLayerRef.current = marker

        const map = new Map({
          target: mapEl.current,
          layers: [tile, marker],
          view: new View({
            center: center3857,
            zoom: typeof lat === 'number' && typeof lon === 'number' ? 17 : 14
          }),
          controls: defaultControls({ zoom: false, rotate: false, attribution: false }).extend([
            new Zoom(),
            new Attribution({ collapsible: true, collapsed: true }),
          ]),
        })
        mapRef.current = map

        if (typeof lat === 'number' && typeof lon === 'number') {
          const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) })
          f.setStyle(new Style({
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: '#2563eb' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 })
            })
          }))
          markerSource.clear()
          markerSource.addFeature(f)
        }

        cleanup = () => {
          try {
            map.setTarget(undefined)
          } catch { }
        }
      })()

    return () => cleanup()
  }, [lat, lon])

  // Update marker jika lat/lon berubah
  useEffect(() => {
    ; (async () => {
      if (!markerLayerRef.current || !mapRef.current) return
      const { default: _VectorSource } = await import('ol/source/Vector')
      const { default: Feature } = await import('ol/Feature')
      const { default: Point } = await import('ol/geom/Point')
      const { fromLonLat } = await import('ol/proj')
      const { Style, Fill, Stroke } = await import('ol/style')
      const { default: CircleStyle } = await import('ol/style/Circle')
      const source = markerLayerRef.current.getSource() as import('ol/source/Vector').default

      if (typeof lat === 'number' && typeof lon === 'number') {
        const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) })
        f.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#2563eb' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 })
          })
        }))
        source.clear()
        source.addFeature(f)

        try {
          const view = mapRef.current.getView()
          const center = fromLonLat([lon, lat])
          view.setCenter(center)
          view.setZoom(17)
        } catch { }
      } else {
        source.clear()
      }
    })()
  }, [lat, lon])

  if (lat == null || lon == null) {
    return (
      <div className="flex items-center justify-center h-[240px] rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-sm text-gray-500 dark:text-gray-400">Koordinat tidak tersedia</div>
      </div>
    )
  }

  return (
    <div
      ref={mapEl}
      style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden' }}
      className="border border-gray-200 dark:border-gray-800"
    />
  )
}

