"use client"

import React, { useEffect, useRef, useState } from 'react'
import 'ol/ol.css'

type TopologyData = {
  otbs: Array<{
    id: string
    name: string
    location: string | null
    latitude: number
    longitude: number
    notes: string | null
  }>
  odcs: Array<{
    id: string
    name: string
    location: string | null
    latitude: number
    longitude: number
    notes: string | null
    otbCore: {
      coreColor: string
      tubeColor: string
      otb: {
        id: string
        name: string
        latitude: number
        longitude: number
      }
    }
  }>
  odps: Array<{
    id: string
    name: string
    location: string | null
    latitude: number
    longitude: number
    notes: string | null
    odcOutput: {
      coreColor: string
      tubeColor: string
      odc: {
        id: string
        name: string
        latitude: number
        longitude: number
      }
    }
  }>
  joinboxes: Array<{
    id: string
    name: string
    location: string | null
    latitude: number
    longitude: number
    notes: string | null
  }>
  poles: Array<{
    id: string
    name: string
    location: string | null
    latitude: number
    longitude: number
    notes: string | null
    cableSlack: boolean
  }>
  kmzFiles: Array<{
    id: string
    name: string
    kmlPath: string
    lineColor: string
    isActive: boolean
  }>
}

type VisibilityState = {
  otb: boolean
  odc: boolean
  odp: boolean
  joinbox: boolean
  pole: boolean
  kmz: boolean
}

export default function TopologyMap() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const animationFrameRef = useRef<number | null>(null)
  const dashOffsetRef = useRef<number>(0)
  const [data, setData] = useState<TopologyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<VisibilityState>({
    otb: true,
    odc: true,
    odp: true,
    joinbox: true,
    pole: true,
    kmz: true,
  })
  const [selectedFeature, setSelectedFeature] = useState<any>(null)

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/ftth/topology')
        if (!res.ok) throw new Error('Failed to fetch topology data')
        const json = await res.json()
        setData(json)
      } catch (err: any) {
        setError(err.message || 'Failed to load topology data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Initialize map (only once when data is loaded)
  useEffect(() => {
    if (!mapEl.current || loading || !data) return

    // Prevent multiple map instances - cleanup existing map first
    if (mapRef.current) {
      try {
        mapRef.current.setTarget(undefined)
        mapRef.current = null
      } catch (e) {
        console.error('Error cleaning up existing map:', e)
      }
    }

    // Clear the map container
    if (mapEl.current) {
      mapEl.current.innerHTML = ''
    }

    let cleanup = () => {}
    let isMounted = true
    ;(async () => {
      const { Map, View } = await import('ol')
      const { default: OSM } = await import('ol/source/OSM')
      const { default: TileLayer } = await import('ol/layer/Tile')
      const { default: VectorLayer } = await import('ol/layer/Vector')
      const { default: VectorSource } = await import('ol/source/Vector')
      const { default: KML } = await import('ol/format/KML')
      const { fromLonLat, toLonLat } = await import('ol/proj')
      const { default: Feature } = await import('ol/Feature')
      const { default: Point } = await import('ol/geom/Point')
      const { default: LineString } = await import('ol/geom/LineString')
      const { Style, Fill, Stroke, Text } = await import('ol/style')
      const { default: CircleStyle } = await import('ol/style/Circle')
      const { default: Polygon } = await import('ol/geom/Polygon')
      const { defaults: defaultControls, Zoom, Attribution } = await import('ol/control')
      const { Overlay } = await import('ol')

      // Calculate center from data
      let centerLonLat: [number, number] = [106.816666, -6.2] // Default Jakarta
      if (data) {
        const allCoords: Array<[number, number]> = []
        ;[...data.otbs, ...data.odcs, ...data.odps, ...data.joinboxes, ...data.poles].forEach(
          (item) => {
            if (item.latitude && item.longitude) {
              allCoords.push([item.longitude, item.latitude])
            }
          }
        )
        if (allCoords.length > 0) {
          const avgLon = allCoords.reduce((sum, [lon]) => sum + lon, 0) / allCoords.length
          const avgLat = allCoords.reduce((sum, [, lat]) => sum + lat, 0) / allCoords.length
          centerLonLat = [avgLon, avgLat]
        }
      }

      const center3857 = fromLonLat(centerLonLat)

      // Create layers
      const tile = new TileLayer({ source: new OSM() })

      // Marker layers for each type
      const otbSource = new VectorSource()
      const otbLayer = new VectorLayer({ source: otbSource })
      otbLayer.set('name', 'otb')

      const odcSource = new VectorSource()
      const odcLayer = new VectorLayer({ source: odcSource })
      odcLayer.set('name', 'odc')

      const odpSource = new VectorSource()
      const odpLayer = new VectorLayer({ source: odpSource })
      odpLayer.set('name', 'odp')

      const joinboxSource = new VectorSource()
      const joinboxLayer = new VectorLayer({ source: joinboxSource })
      joinboxLayer.set('name', 'joinbox')

      const poleSource = new VectorSource()
      const poleLayer = new VectorLayer({ source: poleSource })
      poleLayer.set('name', 'pole')

      // KMZ layers - hanya tampilkan garis/polygon, sembunyikan point/marker
      const kmzLayers: any[] = []
      if (data && data.kmzFiles && data.kmzFiles.length > 0) {
        data.kmzFiles.forEach((kmzFile) => {
          if (kmzFile.isActive) {
            const kmzSource = new VectorSource({
              url: kmzFile.kmlPath,
              format: new KML({
                extractStyles: false, // Nonaktifkan extract styles untuk menghindari CORS error pada icon eksternal
                showPointNames: false,
                writeStyles: false,
              }),
            })
            
            // Style function untuk menyembunyikan point dan hanya menampilkan garis/polygon
            // Menggunakan warna dari database (lineColor)
            const kmzLineColor = kmzFile.lineColor || '#3388ff'
            
            // Convert hex color to rgba for fill
            const hexToRgba = (hex: string, alpha: number) => {
              const r = parseInt(hex.slice(1, 3), 16)
              const g = parseInt(hex.slice(3, 5), 16)
              const b = parseInt(hex.slice(5, 7), 16)
              return `rgba(${r}, ${g}, ${b}, ${alpha})`
            }
            
            const kmzStyleFunction = (feature: any) => {
              const geometry = feature.getGeometry()
              const geometryType = geometry.getType()
              
              // Sembunyikan point (marker)
              if (geometryType === 'Point' || geometryType === 'MultiPoint') {
                return null // Tidak tampilkan point
              }
              
              // Tampilkan garis dengan warna custom
              if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
                return new Style({
                  stroke: new Stroke({
                    color: kmzLineColor,
                    width: 2,
                  }),
                })
              }
              
              // Tampilkan polygon dengan warna custom
              if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
                return new Style({
                  fill: new Fill({
                    color: hexToRgba(kmzLineColor, 0.2),
                  }),
                  stroke: new Stroke({
                    color: kmzLineColor,
                    width: 2,
                  }),
                })
              }
              
              // Default style untuk geometry type lainnya
              return new Style({
                stroke: new Stroke({
                  color: kmzLineColor,
                  width: 2,
                }),
              })
            }
            
            const kmzLayer = new VectorLayer({
              source: kmzSource,
              style: kmzStyleFunction,
              zIndex: 1, // Above other layers
            })
            kmzLayer.set('name', `kmz-${kmzFile.id}`)
            kmzLayer.set('kmzId', kmzFile.id)
            kmzLayer.set('kmzName', kmzFile.name)
            kmzLayers.push(kmzLayer)
          }
        })
      }

      // Topology lines layer with animated style
      const topologySource = new VectorSource()
      
      // Function to create animated style for topology lines
      const createAnimatedTopologyStyle = (coreColor?: string) => {
        const color = coreColor ? colorNameToHex(coreColor) : '#6366f1'
        return (feature: any, resolution: number) => {
          return new Style({
            stroke: new Stroke({
              color: color,
              width: 3,
              lineDash: [10, 10],
              lineDashOffset: dashOffsetRef.current,
            }),
          })
        }
      }
      
      const topologyLayer = new VectorLayer({ 
        source: topologySource,
        style: createAnimatedTopologyStyle(),
      })
      topologyLayer.set('name', 'topology')
      
      // Animation function for topology lines
      const animateTopology = () => {
        dashOffsetRef.current -= 0.5 // Adjust speed here (negative = forward direction)
        if (dashOffsetRef.current <= -20) {
          dashOffsetRef.current = 0
        }
        
        // Update all topology features with new style
        topologySource.getFeatures().forEach((feature) => {
          const coreColor = feature.get('coreColor')
          const styleFunction = createAnimatedTopologyStyle(coreColor)
          feature.setStyle(styleFunction)
        })
        
        if (mapRef.current) {
          mapRef.current.render()
        }
        
        animationFrameRef.current = requestAnimationFrame(animateTopology)
      }
      
      // Start animation
      animateTopology()

      // Check if component is still mounted before creating map
      if (!isMounted || !mapEl.current) return

      // Double check - prevent creating map if already exists
      if (mapRef.current) {
        try {
          mapRef.current.setTarget(undefined)
          mapRef.current = null
        } catch (e) {}
      }

      // Create map
      const view = new View({ center: center3857, zoom: data && data.otbs.length > 0 ? 12 : 10 })
      const map = new Map({
        target: mapEl.current as HTMLDivElement,
        layers: [
          tile,
          topologyLayer,
          ...kmzLayers, // Add KMZ layers
          otbLayer,
          odcLayer,
          odpLayer,
          joinboxLayer,
          poleLayer,
        ],
        view: view,
        controls: defaultControls({ zoom: false, rotate: false, attribution: false }).extend([
          new Zoom(),
          new Attribution({ collapsible: true, collapsed: true }),
        ]),
      })

      // Check again before assigning to ref
      if (!isMounted) {
        map.setTarget(undefined)
        return
      }

      // Popup overlay
      const popupEl = document.createElement('div')
      popupEl.className =
        'bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px]'
      popupEl.style.display = 'none'
      document.body.appendChild(popupEl)

      const popup = new Overlay({
        element: popupEl,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -10],
      })
      map.addOverlay(popup)

      // Styles
      const otbStyle = new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#3b82f6' }), // Blue
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#1e40af' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const odcStyle = new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: '#10b981' }), // Green
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#059669' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const odpStyle = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#f97316' }), // Orange
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#c2410c' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const joinboxStyle = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#a855f7' }), // Purple
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#7c3aed' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const poleStyle = new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#6b7280' }), // Gray
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#4b5563' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      // Function to convert color name to hex
      const colorNameToHex = (colorName: string): string => {
        if (!colorName) return '#6366f1'
        
        // If already hex color, return as is
        if (colorName.startsWith('#')) {
          return colorName.length === 7 ? colorName : '#6366f1'
        }
        
        const colorMap: Record<string, string> = {
          red: '#ef4444',
          merah: '#ef4444',
          blue: '#3b82f6',
          biru: '#3b82f6',
          green: '#10b981',
          hijau: '#10b981',
          yellow: '#eab308',
          kuning: '#eab308',
          orange: '#f97316',
          jingga: '#f97316',
          purple: '#a855f7',
          ungu: '#a855f7',
          pink: '#ec4899',
          merahmuda: '#ec4899',
          brown: '#a16207',
          coklat: '#a16207',
          black: '#000000',
          hitam: '#000000',
          white: '#ffffff',
          putih: '#ffffff',
          gray: '#6b7280',
          grey: '#6b7280',
          abu: '#6b7280',
          abuabu: '#6b7280',
        }
        const normalized = colorName.toLowerCase().trim()
        return colorMap[normalized] || '#6366f1' // Default to indigo if not found
      }


      // Click handler
      map.on('click', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f)
        
        // Skip jika tidak ada feature atau feature adalah topology
        if (!feature || feature.get('type') === 'topology') {
          popupEl.style.display = 'none'
          setSelectedFeature(null)
          return
        }
        
        const featureType = feature.get('type')
        const featureData = feature.get('data')
        
        // Check if featureData exists and has required properties
        // Feature dari KMZ tidak memiliki data, jadi skip popup untuk mereka
        if (!featureData || typeof featureData !== 'object') {
          popupEl.style.display = 'none'
          setSelectedFeature(null)
          return
        }
        
        // Double check bahwa featureData memiliki property name yang valid
        if (!('name' in featureData) || featureData.name === undefined || featureData.name === null) {
          popupEl.style.display = 'none'
          setSelectedFeature(null)
          return
        }
        
        setSelectedFeature({ type: featureType, data: featureData })

        const coordinate = evt.coordinate
        
        // Build popup content safely dengan null checks
        const name = (featureData && featureData.name) ? String(featureData.name) : 'Tidak ada nama'
        const location = (featureData && featureData.location) ? String(featureData.location) : null
        const notes = (featureData && featureData.notes) ? String(featureData.notes) : null
        const latitude = (featureData && typeof featureData.latitude === 'number') ? featureData.latitude.toFixed(6) : 'N/A'
        const longitude = (featureData && typeof featureData.longitude === 'number') ? featureData.longitude.toFixed(6) : 'N/A'
        const typeLabel = featureType ? String(featureType).toUpperCase() : 'UNKNOWN'
        
        popupEl.innerHTML = `
          <div class="space-y-2">
            <div class="font-semibold text-sm">${name}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400">
              <div>Tipe: ${typeLabel}</div>
              ${location ? `<div>Lokasi: ${location}</div>` : ''}
              <div>Koordinat: ${latitude}, ${longitude}</div>
              ${notes ? `<div class="mt-1">Catatan: ${notes}</div>` : ''}
            </div>
          </div>
        `
        popup.setPosition(coordinate)
        popupEl.style.display = 'block'
      })

      // Set initial visibility
      otbLayer.setVisible(visibility.otb)
      odcLayer.setVisible(visibility.odc)
      odpLayer.setVisible(visibility.odp)
      joinboxLayer.setVisible(visibility.joinbox)
      poleLayer.setVisible(visibility.pole)
      kmzLayers.forEach((layer) => layer.setVisible(visibility.kmz))
      topologyLayer.setVisible(
        (visibility.otb && visibility.odc) || (visibility.odc && visibility.odp)
      )

      // Only assign to ref if component is still mounted
      if (isMounted) {
        mapRef.current = map
      } else {
        // Component unmounted, cleanup map
        map.setTarget(undefined)
        map.dispose()
      }
      
      // Trigger initial feature load by calling the update function
      // This ensures features are added immediately when map is created
      // We'll use a small delay to ensure map is fully initialized
      setTimeout(() => {
        // Force the second useEffect to run by updating a ref or state
        // Actually, we can just manually trigger the feature update here
        if (data) {
          // Import and add features immediately
          ;(async () => {
            const { default: VectorSource } = await import('ol/source/Vector')
            const { default: Feature } = await import('ol/Feature')
            const { default: Point } = await import('ol/geom/Point')
            const { default: LineString } = await import('ol/geom/LineString')
            const { fromLonLat } = await import('ol/proj')
            const { Style, Fill, Stroke, Text } = await import('ol/style')
            const { default: CircleStyle } = await import('ol/style/Circle')

            // Create styles
            const otbStyle = new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: '#3b82f6' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
              text: new Text({
                text: '',
                offsetY: -15,
                fill: new Fill({ color: '#1e40af' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                font: 'bold 12px sans-serif',
              }),
            })

            const odcStyle = new Style({
              image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: '#10b981' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
              text: new Text({
                text: '',
                offsetY: -15,
                fill: new Fill({ color: '#059669' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                font: 'bold 12px sans-serif',
              }),
            })

            const odpStyle = new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: '#f97316' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
              text: new Text({
                text: '',
                offsetY: -15,
                fill: new Fill({ color: '#c2410c' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                font: 'bold 12px sans-serif',
              }),
            })

            const joinboxStyle = new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: '#a855f7' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
              text: new Text({
                text: '',
                offsetY: -15,
                fill: new Fill({ color: '#7c3aed' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                font: 'bold 12px sans-serif',
              }),
            })

            const poleStyle = new Style({
              image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color: '#6b7280' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
              text: new Text({
                text: '',
                offsetY: -15,
                fill: new Fill({ color: '#4b5563' }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                font: 'bold 12px sans-serif',
              }),
            })

            const colorNameToHex = (colorName: string): string => {
              if (!colorName) return '#6366f1'
              if (colorName.startsWith('#')) {
                return colorName.length === 7 ? colorName : '#6366f1'
              }
              const colorMap: Record<string, string> = {
                red: '#ef4444', merah: '#ef4444',
                blue: '#3b82f6', biru: '#3b82f6',
                green: '#10b981', hijau: '#10b981',
                yellow: '#eab308', kuning: '#eab308',
                orange: '#f97316', jingga: '#f97316',
                purple: '#a855f7', ungu: '#a855f7',
                pink: '#ec4899', merahmuda: '#ec4899',
                brown: '#a16207', coklat: '#a16207',
                black: '#000000', hitam: '#000000',
                white: '#ffffff', putih: '#ffffff',
                gray: '#6b7280', grey: '#6b7280', abu: '#6b7280', abuabu: '#6b7280',
              }
              const normalized = colorName.toLowerCase().trim()
              return colorMap[normalized] || '#6366f1'
            }

            // Create animated topology style function
            const createTopologyStyle = (coreColor?: string) => {
              const color = coreColor ? colorNameToHex(coreColor) : '#6366f1'
              return (feature: any, resolution: number) => {
                return new Style({
                  stroke: new Stroke({
                    color: color,
                    width: 3,
                    lineDash: [10, 10],
                    lineDashOffset: dashOffsetRef.current,
                  }),
                })
              }
            }

            // Clear and add features
            otbSource.clear()
            odcSource.clear()
            odpSource.clear()
            joinboxSource.clear()
            poleSource.clear()
            topologySource.clear()

            if (visibility.otb) {
              data.otbs.forEach((otb) => {
                const f = new Feature({
                  geometry: new Point(fromLonLat([otb.longitude, otb.latitude])),
                })
                const style = otbStyle.clone()
                style.getText().setText(otb.name)
                f.setStyle(style)
                f.set('type', 'otb')
                f.set('data', otb)
                otbSource.addFeature(f)
              })
            }

            if (visibility.odc) {
              data.odcs.forEach((odc) => {
                const f = new Feature({
                  geometry: new Point(fromLonLat([odc.longitude, odc.latitude])),
                })
                const style = odcStyle.clone()
                style.getText().setText(odc.name)
                f.setStyle(style)
                f.set('type', 'odc')
                f.set('data', odc)
                odcSource.addFeature(f)

                if (visibility.otb && odc.otbCore?.otb?.latitude && odc.otbCore?.otb?.longitude) {
                  const line = new Feature({
                    geometry: new LineString([
                      fromLonLat([odc.otbCore.otb.longitude, odc.otbCore.otb.latitude]),
                      fromLonLat([odc.longitude, odc.latitude]),
                    ]),
                  })
                  const coreColor = odc.otbCore?.coreColor
                  const styleFunction = createTopologyStyle(coreColor)
                  line.setStyle(styleFunction)
                  line.set('type', 'topology')
                  line.set('from', 'OTB')
                  line.set('to', 'ODC')
                  line.set('coreColor', coreColor || '')
                  topologySource.addFeature(line)
                }
              })
            }

            if (visibility.odp) {
              data.odps.forEach((odp) => {
                const f = new Feature({
                  geometry: new Point(fromLonLat([odp.longitude, odp.latitude])),
                })
                const style = odpStyle.clone()
                style.getText().setText(odp.name)
                f.setStyle(style)
                f.set('type', 'odp')
                f.set('data', odp)
                odpSource.addFeature(f)

                if (visibility.odc && odp.odcOutput?.odc?.latitude && odp.odcOutput?.odc?.longitude) {
                  const line = new Feature({
                    geometry: new LineString([
                      fromLonLat([odp.odcOutput.odc.longitude, odp.odcOutput.odc.latitude]),
                      fromLonLat([odp.longitude, odp.latitude]),
                    ]),
                  })
                  const coreColor = odp.odcOutput?.coreColor
                  const styleFunction = createTopologyStyle(coreColor)
                  line.setStyle(styleFunction)
                  line.set('type', 'topology')
                  line.set('from', 'ODC')
                  line.set('to', 'ODP')
                  line.set('coreColor', coreColor || '')
                  topologySource.addFeature(line)
                }
              })
            }

            if (visibility.joinbox) {
              data.joinboxes.forEach((joinbox) => {
                const f = new Feature({
                  geometry: new Point(fromLonLat([joinbox.longitude, joinbox.latitude])),
                })
                const style = joinboxStyle.clone()
                style.getText().setText(joinbox.name)
                f.setStyle(style)
                f.set('type', 'joinbox')
                f.set('data', joinbox)
                joinboxSource.addFeature(f)
              })
            }

            if (visibility.pole) {
              data.poles.forEach((pole) => {
                const f = new Feature({
                  geometry: new Point(fromLonLat([pole.longitude, pole.latitude])),
                })
                const style = poleStyle.clone()
                style.getText().setText(pole.name)
                f.setStyle(style)
                f.set('type', 'pole')
                f.set('data', pole)
                poleSource.addFeature(f)
              })
            }

            // Update layer visibility
            otbLayer.setVisible(visibility.otb)
            odcLayer.setVisible(visibility.odc)
            odpLayer.setVisible(visibility.odp)
            joinboxLayer.setVisible(visibility.joinbox)
            poleLayer.setVisible(visibility.pole)
            topologyLayer.setVisible(
              (visibility.otb && visibility.odc) || (visibility.odc && visibility.odp)
            )

            // Auto-zoom
            const view = map.getView()
            const allSources = [otbSource, odcSource, odpSource, joinboxSource, poleSource, topologySource]
            const allFeatures: any[] = []
            allSources.forEach((source) => {
              source.getFeatures().forEach((f) => allFeatures.push(f))
            })

            if (allFeatures.length > 0) {
              const tempSource = new VectorSource({ features: allFeatures })
              const extent = tempSource.getExtent()
              if (extent && extent[0] !== Infinity && extent[1] !== Infinity) {
                view.fit(extent, {
                  padding: [50, 50, 50, 50],
                  maxZoom: 18,
                  duration: 500,
                })
              }
            }
          })()
        }
      }, 100)

      cleanup = () => {
        isMounted = false
        try {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
          }
          if (mapRef.current) {
            mapRef.current.setTarget(undefined)
            mapRef.current.dispose()
            mapRef.current = null
          }
          // Safely remove popup element
          if (popupEl) {
            try {
              if (popupEl.parentNode === document.body) {
                document.body.removeChild(popupEl)
              } else if (popupEl.parentNode) {
                popupEl.parentNode.removeChild(popupEl)
              }
            } catch (e) {
              // Element mungkin sudah dihapus, ignore error
              console.warn('Popup element already removed:', e)
            }
          }
          // Clear map container
          if (mapEl.current) {
            mapEl.current.innerHTML = ''
          }
        } catch (e) {
          console.error('Error during cleanup:', e)
        }
      }
    })()

    return () => {
      cleanup()
    }
  }, [data, loading]) // Only depend on data and loading, not visibility

  // Update features when visibility changes (map already exists)
  useEffect(() => {
    if (!mapRef.current || !data || loading) return

    ;(async () => {
      const { default: VectorSource } = await import('ol/source/Vector')
      const { default: Feature } = await import('ol/Feature')
      const { default: Point } = await import('ol/geom/Point')
      const { default: LineString } = await import('ol/geom/LineString')
      const { fromLonLat } = await import('ol/proj')
      const { Style, Fill, Stroke, Text } = await import('ol/style')
      const { default: CircleStyle } = await import('ol/style/Circle')

      const map = mapRef.current
      if (!map) return
      
      const layers = map.getLayers().getArray()
      const otbLayer = layers.find((l: any) => l.get('name') === 'otb') as any
      const odcLayer = layers.find((l: any) => l.get('name') === 'odc') as any
      const odpLayer = layers.find((l: any) => l.get('name') === 'odp') as any
      const joinboxLayer = layers.find((l: any) => l.get('name') === 'joinbox') as any
      const poleLayer = layers.find((l: any) => l.get('name') === 'pole') as any
      const topologyLayer = layers.find((l: any) => l.get('name') === 'topology') as any

      if (!otbLayer || !odcLayer || !odpLayer || !joinboxLayer || !poleLayer || !topologyLayer) {
        console.warn('Layers not found')
        return
      }

      const otbSource = otbLayer.getSource()
      const odcSource = odcLayer.getSource()
      const odpSource = odpLayer.getSource()
      const joinboxSource = joinboxLayer.getSource()
      const poleSource = poleLayer.getSource()
      const topologySource = topologyLayer.getSource()

      if (!otbSource || !odcSource || !odpSource || !joinboxSource || !poleSource || !topologySource) {
        console.warn('Sources not found')
        return
      }

      // Create styles (same as in initialization)
      const otbStyle = new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#3b82f6' }), // Blue
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#1e40af' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const odcStyle = new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: '#10b981' }), // Green
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#059669' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const odpStyle = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#f97316' }), // Orange
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#c2410c' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const joinboxStyle = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#a855f7' }), // Purple
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#7c3aed' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      const poleStyle = new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#6b7280' }), // Gray
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
        text: new Text({
          text: '',
          offsetY: -15,
          fill: new Fill({ color: '#4b5563' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          font: 'bold 12px sans-serif',
        }),
      })

      // Function to convert color name to hex
      const colorNameToHex = (colorName: string): string => {
        if (!colorName) return '#6366f1'
        if (colorName.startsWith('#')) {
          return colorName.length === 7 ? colorName : '#6366f1'
        }
        const colorMap: Record<string, string> = {
          red: '#ef4444', merah: '#ef4444',
          blue: '#3b82f6', biru: '#3b82f6',
          green: '#10b981', hijau: '#10b981',
          yellow: '#eab308', kuning: '#eab308',
          orange: '#f97316', jingga: '#f97316',
          purple: '#a855f7', ungu: '#a855f7',
          pink: '#ec4899', merahmuda: '#ec4899',
          brown: '#a16207', coklat: '#a16207',
          black: '#000000', hitam: '#000000',
          white: '#ffffff', putih: '#ffffff',
          gray: '#6b7280', grey: '#6b7280', abu: '#6b7280', abuabu: '#6b7280',
        }
        const normalized = colorName.toLowerCase().trim()
        return colorMap[normalized] || '#6366f1'
      }

      // Create animated topology style function
      const createTopologyStyle = (coreColor?: string) => {
        const color = coreColor ? colorNameToHex(coreColor) : '#6366f1'
        return (feature: any, resolution: number) => {
          return new Style({
            stroke: new Stroke({
              color: color,
              width: 3,
              lineDash: [10, 10],
              lineDashOffset: dashOffsetRef.current,
            }),
          })
        }
      }

      // Clear all sources
      otbSource.clear()
      odcSource.clear()
      odpSource.clear()
      joinboxSource.clear()
      poleSource.clear()
      topologySource.clear()

      // Add features based on visibility (same logic as before)
      if (visibility.otb) {
        data.otbs.forEach((otb) => {
          const f = new Feature({
            geometry: new Point(fromLonLat([otb.longitude, otb.latitude])),
          })
          const style = otbStyle.clone()
          style.getText().setText(otb.name)
          f.setStyle(style)
          f.set('type', 'otb')
          f.set('data', otb)
          otbSource.addFeature(f)
        })
      }

      if (visibility.odc) {
        data.odcs.forEach((odc) => {
          const f = new Feature({
            geometry: new Point(fromLonLat([odc.longitude, odc.latitude])),
          })
          const style = odcStyle.clone()
          style.getText().setText(odc.name)
          f.setStyle(style)
          f.set('type', 'odc')
          f.set('data', odc)
          odcSource.addFeature(f)

          if (visibility.otb && odc.otbCore?.otb?.latitude && odc.otbCore?.otb?.longitude) {
            const line = new Feature({
              geometry: new LineString([
                fromLonLat([odc.otbCore.otb.longitude, odc.otbCore.otb.latitude]),
                fromLonLat([odc.longitude, odc.latitude]),
              ]),
            })
            const coreColor = odc.otbCore?.coreColor
            const styleFunction = createTopologyStyle(coreColor)
            line.setStyle(styleFunction)
            line.set('type', 'topology')
            line.set('from', 'OTB')
            line.set('to', 'ODC')
            line.set('coreColor', coreColor || '')
            topologySource.addFeature(line)
          }
        })
      }

      if (visibility.odp) {
        data.odps.forEach((odp) => {
          const f = new Feature({
            geometry: new Point(fromLonLat([odp.longitude, odp.latitude])),
          })
          const style = odpStyle.clone()
          style.getText().setText(odp.name)
          f.setStyle(style)
          f.set('type', 'odp')
          f.set('data', odp)
          odpSource.addFeature(f)

          if (visibility.odc && odp.odcOutput?.odc?.latitude && odp.odcOutput?.odc?.longitude) {
            const line = new Feature({
              geometry: new LineString([
                fromLonLat([odp.odcOutput.odc.longitude, odp.odcOutput.odc.latitude]),
                fromLonLat([odp.longitude, odp.latitude]),
              ]),
            })
            const coreColor = odp.odcOutput?.coreColor
            const styleFunction = createTopologyStyle(coreColor)
            line.setStyle(styleFunction)
            line.set('type', 'topology')
            line.set('from', 'ODC')
            line.set('to', 'ODP')
            line.set('coreColor', coreColor || '')
            topologySource.addFeature(line)
          }
        })
      }

      if (visibility.joinbox) {
        data.joinboxes.forEach((joinbox) => {
          const f = new Feature({
            geometry: new Point(fromLonLat([joinbox.longitude, joinbox.latitude])),
          })
          const style = joinboxStyle.clone()
          style.getText().setText(joinbox.name)
          f.setStyle(style)
          f.set('type', 'joinbox')
          f.set('data', joinbox)
          joinboxSource.addFeature(f)
        })
      }

      if (visibility.pole) {
        data.poles.forEach((pole) => {
          const f = new Feature({
            geometry: new Point(fromLonLat([pole.longitude, pole.latitude])),
          })
          const style = poleStyle.clone()
          style.getText().setText(pole.name)
          f.setStyle(style)
          f.set('type', 'pole')
          f.set('data', pole)
          poleSource.addFeature(f)
        })
      }

      // Update layer visibility - set after features are added/removed
      // When visibility is false, source is already empty (features not added above)
      // So we just need to hide the layer
      otbLayer.setVisible(visibility.otb)
      odcLayer.setVisible(visibility.odc)
      odpLayer.setVisible(visibility.odp)
      joinboxLayer.setVisible(visibility.joinbox)
      poleLayer.setVisible(visibility.pole)
      
      // Update KMZ layers visibility
      const allLayers = map.getLayers().getArray()
      const kmzLayersToUpdate = allLayers.filter((layer: any) => 
        layer.get('name') && layer.get('name').startsWith('kmz-')
      )
      kmzLayersToUpdate.forEach((layer: any) => {
        layer.setVisible(visibility.kmz)
      })
      
      topologyLayer.setVisible(
        (visibility.otb && visibility.odc) || (visibility.odc && visibility.odp)
      )
      
      // Force map to re-render to reflect visibility changes
      // Use requestAnimationFrame to ensure render happens after all updates
      requestAnimationFrame(() => {
        map.render()
      })

      // Auto-zoom to fit all visible features
      const view = map.getView()
      const allSources = [otbSource, odcSource, odpSource, joinboxSource, poleSource, topologySource]
      const allFeatures: any[] = []
      allSources.forEach((source) => {
        source.getFeatures().forEach((f) => allFeatures.push(f))
      })

      if (allFeatures.length > 0) {
        const { default: VectorSource } = await import('ol/source/Vector')
        const tempSource = new VectorSource({ features: allFeatures })
        const extent = tempSource.getExtent()
        if (extent && extent[0] !== Infinity && extent[1] !== Infinity) {
          view.fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 18,
            duration: 500,
          })
        }
      }
    })()
  }, [visibility, data, loading])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-sm text-gray-600 dark:text-gray-400">Memuat data topologi...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-sm text-gray-600 dark:text-gray-400">Tidak ada data</div>
      </div>
    )
  }

  const stats = {
    otb: data.otbs.length,
    odc: data.odcs.length,
    odp: data.odps.length,
    joinbox: data.joinboxes.length,
    pole: data.poles.length,
  }

  return (
    <div className="space-y-4">
      {/* Stats Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
          <div className="text-xs text-blue-600 dark:text-blue-400">OTB</div>
          <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">{stats.otb}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
          <div className="text-xs text-green-600 dark:text-green-400">ODC</div>
          <div className="text-lg font-semibold text-green-900 dark:text-green-100">
            {stats.odc}
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md">
          <div className="text-xs text-orange-600 dark:text-orange-400">ODP</div>
          <div className="text-lg font-semibold text-orange-900 dark:text-orange-100">
            {stats.odp}
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md">
          <div className="text-xs text-purple-600 dark:text-purple-400">Joinbox</div>
          <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
            {stats.joinbox}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/20 p-3 rounded-md">
          <div className="text-xs text-gray-600 dark:text-gray-400">Pole</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {stats.pole}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div ref={mapEl} className="w-full h-[600px] rounded-lg border border-gray-200 dark:border-gray-800" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10 min-w-[200px]">
          <div className="text-sm font-semibold mb-3">Tampilkan</div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
              <span>OTB</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
              <span>ODC</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white"></div>
              <span>ODP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white"></div>
              <span>Joinbox</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white"></div>
              <span>Pole</span>
            </div>
            {data && data.kmzFiles && data.kmzFiles.filter(f => f.isActive).length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-yellow-500 bg-yellow-200"></div>
                <span>KMZ</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-indigo-500 border-dashed"></div>
                <span>Topologi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visibility Toggles */}
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-3 z-10">
          <div className="text-xs font-semibold mb-2">Tampilkan</div>
          <div className="space-y-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility.otb}
                onChange={(e) => setVisibility({ ...visibility, otb: e.target.checked })}
                className="rounded"
              />
              <span>OTB</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility.odc}
                onChange={(e) => setVisibility({ ...visibility, odc: e.target.checked })}
                className="rounded"
              />
              <span>ODC</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility.odp}
                onChange={(e) => setVisibility({ ...visibility, odp: e.target.checked })}
                className="rounded"
              />
              <span>ODP</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility.joinbox}
                onChange={(e) => setVisibility({ ...visibility, joinbox: e.target.checked })}
                className="rounded"
              />
              <span>Joinbox</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility.pole}
                onChange={(e) => setVisibility({ ...visibility, pole: e.target.checked })}
                className="rounded"
              />
              <span>Pole</span>
            </label>
            {data && data.kmzFiles && data.kmzFiles.filter(f => f.isActive).length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility.kmz}
                  onChange={(e) => setVisibility({ ...visibility, kmz: e.target.checked })}
                  className="rounded"
                />
                <span>KMZ</span>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

