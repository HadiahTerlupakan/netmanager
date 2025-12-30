"use client"

import React, { useEffect, useRef, useState } from 'react'
import PageLoader from '@/components/ui/PageLoader'

// Global type declaration for CESIUM_BASE_URL
declare global {
  const CESIUM_BASE_URL: string
}

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
  pelanggans: Array<{
    id: string
    idPelanggan: string
    nama: string
    latitude: number
    longitude: number
    alamat: string | null
    status: string
    odpId: string
    odp: {
      id: string
      name: string
      latitude: number
      longitude: number
    }
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
  pelanggan: boolean
  kmz: boolean
}

interface TopologyMap3DProps {
  data: TopologyData | null
  visibility: VisibilityState
}

export default function TopologyMap3D({ data, visibility }: TopologyMap3DProps) {
  const cesiumContainer = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cesiumContainer.current || !data) return

    let isMounted = true

    const initCesium = async () => {
      try {
        // Set CESIUM_BASE_URL before importing
        if (typeof window !== 'undefined') {
          (window as any).CESIUM_BASE_URL = '/cesium'
        }

        // Dynamic import Cesium
        const Cesium = await import('cesium')
        
        // CSS is loaded via head link instead of import to avoid TypeScript errors
        if (typeof document !== 'undefined' && !document.querySelector('link[href="/cesium/Widgets/widgets.css"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = '/cesium/Widgets/widgets.css'
          document.head.appendChild(link)
        }

        if (!isMounted || !cesiumContainer.current) return

        // Set access token
        const token = process.env.NEXT_PUBLIC_CESIUM_TOKEN
        if (token) {
          Cesium.Ion.defaultAccessToken = token
        }

        // Cleanup existing viewer
        if (viewerRef.current) {
          viewerRef.current.destroy()
          viewerRef.current = null
        }

        // Calculate center from data
        let centerLon = 106.816666
        let centerLat = -6.2
        const allCoords: Array<[number, number]> = []
        ;[...data.otbs, ...data.odcs, ...data.odps, ...data.joinboxes, ...data.poles].forEach(
          (item) => {
            if (item.latitude && item.longitude) {
              allCoords.push([item.longitude, item.latitude])
            }
          }
        )
        if (allCoords.length > 0) {
          centerLon = allCoords.reduce((sum, [lon]) => sum + lon, 0) / allCoords.length
          centerLat = allCoords.reduce((sum, [, lat]) => sum + lat, 0) / allCoords.length
        }

        // Create viewer - using Columbus View (2.5D flat map with terrain)
        const viewer = new Cesium.Viewer(cesiumContainer.current, {
          terrain: token ? Cesium.Terrain.fromWorldTerrain() : undefined,
          animation: false,
          timeline: false,
          baseLayerPicker: true,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false, // Disable picker - fixed to Columbus View
          sceneMode: Cesium.SceneMode.COLUMBUS_VIEW, // 2.5D flat map (not globe)
          navigationHelpButton: false,
          selectionIndicator: true,
          infoBox: true,
        })

        viewerRef.current = viewer

        // Set zoom limits (in meters from Earth surface)
        // minimumZoomDistance: minimum height camera can go (closest zoom)
        // maximumZoomDistance: maximum height camera can go (furthest zoom)
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100 // 100 meter (sangat dekat)
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 100000 // 100 km (bisa zoom out lebih jauh)

        // Color mapping function - using any type because Cesium is dynamically imported
        const colorNameToColor = (colorName: string): any => {
          if (!colorName) return Cesium.Color.INDIGO
          const colorMap: Record<string, any> = {
            red: Cesium.Color.RED,
            merah: Cesium.Color.RED,
            blue: Cesium.Color.BLUE,
            biru: Cesium.Color.BLUE,
            green: Cesium.Color.GREEN,
            hijau: Cesium.Color.GREEN,
            yellow: Cesium.Color.YELLOW,
            kuning: Cesium.Color.YELLOW,
            orange: Cesium.Color.ORANGE,
            jingga: Cesium.Color.ORANGE,
            purple: Cesium.Color.PURPLE,
            ungu: Cesium.Color.PURPLE,
          }
          return colorMap[colorName.toLowerCase()] || Cesium.Color.INDIGO
        }

        // Add OTB markers
        if (visibility.otb) {
          data.otbs.forEach((otb) => {
            if (otb.latitude && otb.longitude) {
              viewer.entities.add({
                id: `otb-${otb.id}`,
                name: otb.name,
                position: Cesium.Cartesian3.fromDegrees(otb.longitude, otb.latitude, 50),
                point: {
                  pixelSize: 16,
                  color: Cesium.Color.BLUE,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                label: {
                  text: otb.name,
                  font: 'bold 12px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLUE,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -20),
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                description: `
                  <h3>${otb.name}</h3>
                  <p><strong>Tipe:</strong> OTB</p>
                  <p><strong>Lokasi:</strong> ${otb.location || '-'}</p>
                  <p><strong>Koordinat:</strong> ${otb.latitude.toFixed(6)}, ${otb.longitude.toFixed(6)}</p>
                  ${otb.notes ? `<p><strong>Catatan:</strong> ${otb.notes}</p>` : ''}
                `,
              })
            }
          })
        }

        // Add ODC markers and lines to OTB
        if (visibility.odc) {
          data.odcs.forEach((odc) => {
            if (odc.latitude && odc.longitude) {
              viewer.entities.add({
                id: `odc-${odc.id}`,
                name: odc.name,
                position: Cesium.Cartesian3.fromDegrees(odc.longitude, odc.latitude, 30),
                point: {
                  pixelSize: 14,
                  color: Cesium.Color.GREEN,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                label: {
                  text: odc.name,
                  font: 'bold 11px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.GREEN,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -18),
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                description: `
                  <h3>${odc.name}</h3>
                  <p><strong>Tipe:</strong> ODC</p>
                  <p><strong>Lokasi:</strong> ${odc.location || '-'}</p>
                  <p><strong>Koordinat:</strong> ${odc.latitude.toFixed(6)}, ${odc.longitude.toFixed(6)}</p>
                  ${odc.notes ? `<p><strong>Catatan:</strong> ${odc.notes}</p>` : ''}
                `,
              })

              // Line from OTB to ODC
              if (visibility.otb && odc.otbCore?.otb) {
                const otb = odc.otbCore.otb
                viewer.entities.add({
                  id: `line-otb-odc-${odc.id}`,
                  polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                      otb.longitude, otb.latitude, 50,
                      odc.longitude, odc.latitude, 30,
                    ]),
                    width: 3,
                    material: new Cesium.PolylineDashMaterialProperty({
                      color: colorNameToColor(odc.otbCore?.coreColor),
                      dashLength: 16,
                    }),
                  },
                })
              }
            }
          })
        }

        // Add ODP markers and lines to ODC
        if (visibility.odp) {
          data.odps.forEach((odp) => {
            if (odp.latitude && odp.longitude) {
              viewer.entities.add({
                id: `odp-${odp.id}`,
                name: odp.name,
                position: Cesium.Cartesian3.fromDegrees(odp.longitude, odp.latitude, 15),
                point: {
                  pixelSize: 12,
                  color: Cesium.Color.ORANGE,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                label: {
                  text: odp.name,
                  font: 'bold 10px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.ORANGE,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -16),
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                description: `
                  <h3>${odp.name}</h3>
                  <p><strong>Tipe:</strong> ODP</p>
                  <p><strong>Lokasi:</strong> ${odp.location || '-'}</p>
                  <p><strong>Koordinat:</strong> ${odp.latitude.toFixed(6)}, ${odp.longitude.toFixed(6)}</p>
                  ${odp.notes ? `<p><strong>Catatan:</strong> ${odp.notes}</p>` : ''}
                `,
              })

              // Line from ODC to ODP
              if (visibility.odc && odp.odcOutput?.odc) {
                const odc = odp.odcOutput.odc
                viewer.entities.add({
                  id: `line-odc-odp-${odp.id}`,
                  polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                      odc.longitude, odc.latitude, 30,
                      odp.longitude, odp.latitude, 15,
                    ]),
                    width: 2,
                    material: new Cesium.PolylineDashMaterialProperty({
                      color: colorNameToColor(odp.odcOutput?.coreColor),
                      dashLength: 12,
                    }),
                  },
                })
              }
            }
          })
        }

        // Add Joinbox markers
        if (visibility.joinbox) {
          data.joinboxes.forEach((jb) => {
            if (jb.latitude && jb.longitude) {
              viewer.entities.add({
                id: `jb-${jb.id}`,
                name: jb.name,
                position: Cesium.Cartesian3.fromDegrees(jb.longitude, jb.latitude, 20),
                point: {
                  pixelSize: 12,
                  color: Cesium.Color.PURPLE,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                label: {
                  text: jb.name,
                  font: 'bold 10px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.PURPLE,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -16),
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                description: `
                  <h3>${jb.name}</h3>
                  <p><strong>Tipe:</strong> Joinbox</p>
                  <p><strong>Lokasi:</strong> ${jb.location || '-'}</p>
                  <p><strong>Koordinat:</strong> ${jb.latitude.toFixed(6)}, ${jb.longitude.toFixed(6)}</p>
                  ${jb.notes ? `<p><strong>Catatan:</strong> ${jb.notes}</p>` : ''}
                `,
              })
            }
          })
        }

        // Add Pole markers
        if (visibility.pole) {
          data.poles.forEach((pole) => {
            if (pole.latitude && pole.longitude) {
              viewer.entities.add({
                id: `pole-${pole.id}`,
                name: pole.name,
                position: Cesium.Cartesian3.fromDegrees(pole.longitude, pole.latitude, 5),
                point: {
                  pixelSize: 10,
                  color: Cesium.Color.GRAY,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                description: `
                  <h3>${pole.name}</h3>
                  <p><strong>Tipe:</strong> Pole</p>
                  <p><strong>Lokasi:</strong> ${pole.location || '-'}</p>
                  <p><strong>Koordinat:</strong> ${pole.latitude.toFixed(6)}, ${pole.longitude.toFixed(6)}</p>
                  ${pole.cableSlack ? '<p><strong>Cable Slack:</strong> Yes</p>' : ''}
                  ${pole.notes ? `<p><strong>Catatan:</strong> ${pole.notes}</p>` : ''}
                `,
              })
            }
          })
        }

        // Add Pelanggan markers
        if (visibility.pelanggan && data.pelanggans) {
          data.pelanggans.forEach((p) => {
            if (p.latitude && p.longitude) {
              viewer.entities.add({
                id: `pelanggan-${p.id}`,
                name: p.nama || p.idPelanggan,
                position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 2),
                point: {
                  pixelSize: 8,
                  color: Cesium.Color.HOTPINK,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 1,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                description: `
                  <h3>${p.nama || p.idPelanggan}</h3>
                  <p><strong>ID:</strong> ${p.idPelanggan}</p>
                  <p><strong>Status:</strong> ${p.status}</p>
                  <p><strong>Alamat:</strong> ${p.alamat || '-'}</p>
                  <p><strong>ODP:</strong> ${p.odp?.name || '-'}</p>
                  <p><strong>Koordinat:</strong> ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</p>
                `,
              })
            }
          })
        }

        // Load KMZ files
        if (visibility.kmz && data.kmzFiles && data.kmzFiles.length > 0) {
          for (const kmzFile of data.kmzFiles) {
            if (kmzFile.isActive && kmzFile.kmlPath) {
              try {
                // Load KML/KMZ using KmlDataSource
                const dataSource = await Cesium.KmlDataSource.load(kmzFile.kmlPath, {
                  camera: viewer.scene.camera,
                  canvas: viewer.scene.canvas,
                  clampToGround: true,
                })
                
                // Apply custom line color from database
                if (kmzFile.lineColor) {
                  const color = Cesium.Color.fromCssColorString(kmzFile.lineColor)
                  dataSource.entities.values.forEach((entity: any) => {
                    if (entity.polyline) {
                      entity.polyline.material = color
                      entity.polyline.width = 3
                    }
                    if (entity.polygon) {
                      entity.polygon.material = color.withAlpha(0.3)
                      entity.polygon.outlineColor = color
                    }
                    // Hide point markers from KMZ
                    if (entity.billboard) {
                      entity.billboard.show = false
                    }
                    if (entity.label) {
                      entity.label.show = false
                    }
                  })
                }
                
                viewer.dataSources.add(dataSource)
                console.log(`KMZ loaded: ${kmzFile.name}`)
              } catch (err) {
                console.error(`Error loading KMZ ${kmzFile.name}:`, err)
              }
            }
          }
        }

        // Fly to center
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 5000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 2,
        })

        setLoading(false)
      } catch (err: any) {
        console.error('Cesium init error:', err)
        setError(err.message || 'Gagal memuat Cesium 3D Map')
        setLoading(false)
      }
    }

    initCesium()

    return () => {
      isMounted = false
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy()
        } catch (e) {
          console.error('Error destroying viewer:', e)
        }
        viewerRef.current = null
      }
    }
  }, [data, visibility])

  if (error) {
    return (
      <div className="w-full h-[600px] bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
          <p className="text-sm text-gray-500">Pastikan NEXT_PUBLIC_CESIUM_TOKEN sudah dikonfigurasi di .env</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <PageLoader />
        </div>
      )}
      <div ref={cesiumContainer} className="w-full h-full" />
    </div>
  )
}
