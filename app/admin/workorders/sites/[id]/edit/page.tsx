'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineArrowLeft, HiOutlineMapPin } from 'react-icons/hi2'

declare global {
    interface Window {
        L: any
    }
}

interface Site {
    id: string
    code: string
    name: string
    description: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    isActive: boolean
}

export default function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markerRef = useRef<any>(null)

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        address: '',
        latitude: '',
        longitude: '',
        isActive: true,
    })

    // Fetch existing site data
    useEffect(() => {
        const fetchSite = async () => {
            try {
                const response = await fetch(`/api/admin/sites/${id}`)
                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Gagal memuat data site')
                }

                const site: Site = data.data
                setFormData({
                    code: site.code,
                    name: site.name,
                    description: site.description || '',
                    address: site.address || '',
                    latitude: site.latitude?.toString() || '',
                    longitude: site.longitude?.toString() || '',
                    isActive: site.isActive,
                })
            } catch (error) {
                console.error('Error fetching site:', error)
                setError(error instanceof Error ? error.message : 'Gagal memuat data site')
            } finally {
                setFetching(false)
            }
        }

        fetchSite()
    }, [id])

    // Initialize Leaflet map
    useEffect(() => {
        if (fetching) return

        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            document.head.appendChild(link)
        }

        // Load Leaflet JS
        if (!window.L) {
            const script = document.createElement('script')
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
            script.onload = initMap
            document.head.appendChild(script)
        } else {
            initMap()
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
        }
    }, [fetching])

    const initMap = () => {
        if (!mapRef.current || mapInstanceRef.current) return

        const L = window.L
        const lat = formData.latitude ? parseFloat(formData.latitude) : -6.200000
        const lng = formData.longitude ? parseFloat(formData.longitude) : 106.816666
        const zoom = formData.latitude && formData.longitude ? 15 : 10

        const map = L.map(mapRef.current).setView([lat, lng], zoom)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map)

        // Add marker if coordinates exist
        if (formData.latitude && formData.longitude) {
            markerRef.current = L.marker([lat, lng]).addTo(map)
        }

        // Click handler to place marker
        map.on('click', (e: any) => {
            const { lat, lng } = e.latlng
            setFormData(prev => ({
                ...prev,
                latitude: lat.toFixed(6),
                longitude: lng.toFixed(6)
            }))

            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng])
            } else {
                markerRef.current = L.marker([lat, lng]).addTo(map)
            }
        })

        mapInstanceRef.current = map
    }

    // Update marker when coordinates change manually
    useEffect(() => {
        if (mapInstanceRef.current && formData.latitude && formData.longitude) {
            const lat = parseFloat(formData.latitude)
            const lng = parseFloat(formData.longitude)

            if (!isNaN(lat) && !isNaN(lng)) {
                if (markerRef.current) {
                    markerRef.current.setLatLng([lat, lng])
                } else if (window.L) {
                    markerRef.current = window.L.marker([lat, lng]).addTo(mapInstanceRef.current)
                }
                mapInstanceRef.current.setView([lat, lng], 15)
            }
        }
    }, [formData.latitude, formData.longitude])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/admin/sites/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    latitude: formData.latitude || null,
                    longitude: formData.longitude || null,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Gagal mengupdate site')
            }

            router.push('/admin/workorders/sites')
        } catch (error) {
            console.error('Error updating site:', error)
            setError(error instanceof Error ? error.message : 'Gagal mengupdate site')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        const checked = (e.target as HTMLInputElement).checked

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name === 'code' ? value.toUpperCase() : value)
        }))
    }

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords
                    setFormData(prev => ({
                        ...prev,
                        latitude: latitude.toFixed(6),
                        longitude: longitude.toFixed(6)
                    }))
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

    if (fetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data site...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/workorders/sites"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <HiOutlineArrowLeft className="h-5 w-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Edit Site
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formData.code} - {formData.name}
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Informasi Site
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Kode Site <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                required
                                placeholder="JKT-01"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nama Site <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Jakarta Pusat"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Deskripsi
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={2}
                                placeholder="Deskripsi singkat tentang site ini..."
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Alamat
                            </label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={2}
                                placeholder="Alamat lengkap site..."
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="inline-flex items-center">
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleChange}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Site Aktif</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Map Section */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Lokasi di Peta
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
                        Klik pada peta untuk memilih koordinat lokasi site
                    </p>

                    {/* Map Container */}
                    <div
                        ref={mapRef}
                        className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-700 z-0"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Latitude
                            </label>
                            <input
                                type="text"
                                name="latitude"
                                value={formData.latitude}
                                onChange={handleChange}
                                placeholder="-6.200000"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Longitude
                            </label>
                            <input
                                type="text"
                                name="longitude"
                                value={formData.longitude}
                                onChange={handleChange}
                                placeholder="106.816666"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <Link
                        href="/admin/workorders/sites"
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </form>
        </div>
    )
}
