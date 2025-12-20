'use client'

import { useEffect, useRef, useState } from 'react'
import { HiOutlineMapPin } from 'react-icons/hi2'
import Script from 'next/script'

interface MapPickerProps {
    latitude: string
    longitude: string
    onChange: (lat: string, lng: string) => void
    label?: string
}

declare global {
    interface Window {
        L: any
    }
}

export default function MapPicker({ latitude, longitude, onChange, label = "Lokasi di Peta" }: MapPickerProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markerRef = useRef<any>(null)
    const [isLeafletLoaded, setIsLeafletLoaded] = useState(false)

    // Helper to ensure map is correctly sized
    const invalidateMapSize = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize()
        }
    }

    // Initialize Map once Leaflet is loaded
    useEffect(() => {
        if (!isLeafletLoaded || !mapRef.current || mapInstanceRef.current) return

        const L = window.L

        // Ensure default icon paths are correct
        delete (L.Icon.Default.prototype as any)._getIconUrl;

        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const initialLat = latitude ? parseFloat(latitude) : -6.200000 // Jakarta
        const initialLng = longitude ? parseFloat(longitude) : 106.816666
        const initialZoom = latitude && longitude ? 15 : 10

        const map = L.map(mapRef.current).setView([initialLat, initialLng], initialZoom)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map)

        // Click handler
        map.on('click', (e: any) => {
            const { lat, lng } = e.latlng
            onChange(lat.toFixed(6), lng.toFixed(6))
        })

        mapInstanceRef.current = map

        // Force resize calculation after a momentary delay to ensure container is fully rendered
        setTimeout(invalidateMapSize, 200)

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
        }
    }, [isLeafletLoaded])

    // Update marker and view when props change
    useEffect(() => {
        if (!mapInstanceRef.current || !isLeafletLoaded) return

        const lat = parseFloat(latitude)
        const lng = parseFloat(longitude)

        if (!isNaN(lat) && !isNaN(lng)) {
            const L = window.L
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng])
            } else {
                markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current)
            }
            mapInstanceRef.current.setView([lat, lng], 15)
        }
    }, [latitude, longitude, isLeafletLoaded])

    // Load CSS manually
    useEffect(() => {
        if (!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            document.head.appendChild(link)
        }
    }, [])

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    onChange(latitude.toFixed(6), longitude.toFixed(6))
                    // Center map if initialized
                    if (mapInstanceRef.current) {
                        mapInstanceRef.current.setView([latitude, longitude], 15)
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
            {/* Load Leaflet JS via next/script */}
            <Script
                src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                strategy="afterInteractive"
                onLoad={() => setIsLeafletLoaded(true)}
                onReady={() => setIsLeafletLoaded(true)}
            />

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
                Klik pada peta untuk memilih titik lokasi. Pastikan marker muncul untuk menyimpan koordinat.
            </p>

            <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 isolate">
                <div
                    ref={mapRef}
                    className="absolute inset-0 z-0 bg-gray-100"
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
