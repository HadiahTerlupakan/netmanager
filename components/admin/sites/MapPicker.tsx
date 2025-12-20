'use client'

import { useEffect, useRef, useState } from 'react'
import { HiOutlineMapPin } from 'react-icons/hi2'
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { Style, Icon } from 'ol/style'
import { fromLonLat, toLonLat } from 'ol/proj'
import { defaults as defaultControls } from 'ol/control'

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

    // Helper to parse coordinates safely
    const getCoordinates = () => {
        const lat = parseFloat(latitude)
        const lng = parseFloat(longitude)
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng }
        }
        return null
    }

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current) return

        // Vector Source and Layer for the marker
        const vectorSource = new VectorSource()
        vectorSourceRef.current = vectorSource

        // Marker Style (using a standard pin icon)
        const markerStyle = new Style({
            image: new Icon({
                anchor: [0.5, 1], // Bottom center
                src: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', // Reusing a reliable CDN asset for the pin
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
            target: mapRef.current,
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
            controls: defaultControls({ zoom: true, attribution: false }) // Simplified controls
        })

        mapInstanceRef.current = map

        // Click handler to pick location
        map.on('click', (event) => {
            const coordinates = toLonLat(event.coordinate)
            const [lng, lat] = coordinates
            onChange(lat.toFixed(6), lng.toFixed(6))
        })

        // Ensure map is correctly sized
        setTimeout(() => map.updateSize(), 100)

        // Cleanup
        return () => {
            map.setTarget(undefined)
            mapInstanceRef.current = null
        }
    }, [])

    // React to props change (updates marker position)
    useEffect(() => {
        const coords = getCoordinates()

        if (coords && vectorSourceRef.current) {
            const pointGeom = new Point(fromLonLat([coords.lng, coords.lat]))

            if (!markerFeatureRef.current) {
                // Create new marker if none exists
                const feature = new Feature({
                    geometry: pointGeom
                })
                markerFeatureRef.current = feature
                vectorSourceRef.current.addFeature(feature)
            } else {
                // Update existing marker geometry
                markerFeatureRef.current.setGeometry(pointGeom)
            }

            // Sync View if needed (Optional: only if map is ready and user explicitly updated via form inputs, 
            // but we usually let the user pan manually to avoid jumping around too much. 
            // However, on first load or direct input, it might be nice. 
            // Let's rely on the map's initial view for the first load, and 'Current Location' button for explicit centering.)
            if (mapInstanceRef.current) {
                // Check if the current view is very far off? 
                // For now, let's just ensure the marker is updated.
            }

        } else if (!coords && markerFeatureRef.current && vectorSourceRef.current) {
            // Remove marker if coordinates become invalid
            vectorSourceRef.current.removeFeature(markerFeatureRef.current)
            markerFeatureRef.current = null
        }
    }, [latitude, longitude])

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
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
