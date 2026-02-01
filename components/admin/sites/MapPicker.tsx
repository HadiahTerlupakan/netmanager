'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { HiOutlineMapPin } from 'react-icons/hi2'
import 'ol/ol.css'

// Types for refs
import type Map from 'ol/Map'
import type VectorSource from 'ol/source/Vector'
import type Feature from 'ol/Feature'

interface MapPickerProps {
    latitude: string
    longitude: string
    onChange: (lat: string, lng: string) => void
    label?: string
}

export default function MapPicker({ latitude, longitude, onChange, label = "Lokasi di Peta" }: MapPickerProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<Map | null>(null)
    const vectorSourceRef = useRef<VectorSource | null>(null)
    const markerFeatureRef = useRef<Feature | null>(null)
    const [isMounted, setIsMounted] = useState(false)

    // Helper to parse coordinates safely
    const getCoordinates = useCallback(() => {
        const lat = parseFloat(latitude)
        const lng = parseFloat(longitude)
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng }
        }
        return null
    }, [latitude, longitude])

    useEffect(() => {
        setIsMounted(true)
        return () => setIsMounted(false)
    }, [])

    // Initialize Map with Dynamic Imports
    useEffect(() => {
        if (!isMounted || !mapRef.current) return

        let cleanup = () => {}

        const initMap = async () => {
            // Dynamic imports
            const { default: Map } = await import('ol/Map')
            const { default: View } = await import('ol/View')
            const { default: TileLayer } = await import('ol/layer/Tile')
            const { default: OSM } = await import('ol/source/OSM')
            const { default: VectorLayer } = await import('ol/layer/Vector')
            const { default: VectorSource } = await import('ol/source/Vector')
            const { default: Feature } = await import('ol/Feature')
            const { default: Point } = await import('ol/geom/Point')
            const { Style, Icon } = await import('ol/style')
            const { fromLonLat, toLonLat } = await import('ol/proj')
            const { defaults: defaultControls } = await import('ol/control')

            // Avoid re-initialization
            if (mapInstanceRef.current) return

            // Vector Source and Layer for the marker
            const vectorSource = new VectorSource()
            vectorSourceRef.current = vectorSource

            // Marker Style
            const markerStyle = new Style({
                image: new Icon({
                    anchor: [0.5, 1],
                    src: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    scale: 1
                })
            })

            const vectorLayer = new VectorLayer({
                source: vectorSource,
                style: markerStyle
            })

            // Determine initial center
            const coords = getCoordinates()
            const initialCenter = coords
                ? fromLonLat([coords.lng, coords.lat])
                : fromLonLat([106.8456, -6.2088]) // Jakarta default

            const map = new Map({
                target: mapRef.current as HTMLElement,
                layers: [
                    new TileLayer({
                        source: new OSM()
                    }),
                    vectorLayer
                ],
                view: new View({
                    center: initialCenter,
                    zoom: coords ? 15 : 10
                }),
                controls: defaultControls({ zoom: true, attribution: false })
            })

            mapInstanceRef.current = map

            // Click handler
            map.on('click', (event) => {
                const coordinates = toLonLat(event.coordinate)
                const [lng, lat] = coordinates
                if (lat !== undefined && lng !== undefined) {
                    onChange(lat.toFixed(6), lng.toFixed(6))
                }
            })

            // Initial marker if coords exist
            if (coords) {
                const pointGeom = new Point(fromLonLat([coords.lng, coords.lat]))
                const feature = new Feature({
                    geometry: pointGeom
                })
                markerFeatureRef.current = feature
                vectorSource.addFeature(feature)
            }

            cleanup = () => {
                map.setTarget(undefined)
                mapInstanceRef.current = null
                vectorSourceRef.current = null
                markerFeatureRef.current = null
            }
        }

        initMap()

        return () => {
            cleanup()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMounted]) // Run once on mount

    // Update marker when props change
    useEffect(() => {
        const updateMarker = async () => {
            if (!mapInstanceRef.current || !vectorSourceRef.current) return

            const { default: Feature } = await import('ol/Feature')
            const { default: Point } = await import('ol/geom/Point')
            const { fromLonLat } = await import('ol/proj')

            const coords = getCoordinates()

            if (coords) {
                const pointGeom = new Point(fromLonLat([coords.lng, coords.lat]))

                if (!markerFeatureRef.current) {
                    const feature = new Feature({
                        geometry: pointGeom
                    })
                    markerFeatureRef.current = feature
                    vectorSourceRef.current.addFeature(feature)
                } else {
                    markerFeatureRef.current.setGeometry(pointGeom)
                }
            } else if (markerFeatureRef.current) {
                vectorSourceRef.current.removeFeature(markerFeatureRef.current)
                markerFeatureRef.current = null
            }
        }

        updateMarker()
    }, [getCoordinates, latitude, longitude])


    const getCurrentLocation = async () => {
        if (navigator.geolocation) {
            // We need to import proj dynamically here as well for the animation
            const { fromLonLat } = await import('ol/proj')

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    onChange(latitude.toFixed(6), longitude.toFixed(6))

                    // Animate map to new location
                    if (mapInstanceRef.current) {
                        mapInstanceRef.current.getView().animate({
                            center: fromLonLat([longitude, latitude]),
                            zoom: 16,
                            duration: 1000
                        })
                    }
                },
                (error) => {
                    console.error('Error getting location:', error)
                    alert('Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.')
                }
            )
        } else {
            alert('Geolocation tidak didukung oleh browser ini.')
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {label}
                </h2>
                <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                    <HiOutlineMapPin className="h-4 w-4 mr-1" />
                    Lokasi Saat Ini
                </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Klik pada peta untuk memilih titik lokasi.
            </p>

            <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 isolate">
                <div
                    ref={mapRef}
                    className="absolute inset-0 z-0 bg-gray-50"
                    style={{ height: '100%', width: '100%' }}
                />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                <div>
                    Lat: <span className="font-mono text-gray-700 dark:text-gray-300">{latitude || '-'}</span>
                </div>
                <div>
                    Lng: <span className="font-mono text-gray-700 dark:text-gray-300">{longitude || '-'}</span>
                </div>
            </div>
        </div>
    )
}
