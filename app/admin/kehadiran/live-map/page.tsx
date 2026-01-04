'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { HiOutlineMapPin, HiOutlineUsers, HiOutlineClock, HiOutlineArrowPath, HiMagnifyingGlass, HiOutlineSignal, HiOutlineMap, HiOutlineSquares2X2 } from 'react-icons/hi2'
import { formatDistanceToNow, format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useSocket } from '@/hooks/useSocket'
import dynamic from 'next/dynamic'

// Dynamic import untuk Map component (OpenLayers needs client-side only)
const EmployeeLocationMap = dynamic(
    () => import('@/components/attendance/EmployeeLocationMap'),
    { ssr: false, loading: () => <div className="h-[500px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><span className="text-gray-400">Memuat peta...</span></div> }
)

interface EmployeeLocation {
    userId: string
    userName: string
    userImage: string | null
    siteName: string | null
    departmentName: string | null
    latitude: number
    longitude: number
    accuracy: number | null
    speed?: number | null
    heading?: number | null
    isMoving: boolean
    batteryLevel: number | null
    recordedAt: string
    checkInTime: string
}

export default function LiveMapPage() {
    const { data: session } = useSession()
    const { socket } = useSocket()
    const [locations, setLocations] = useState<EmployeeLocation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [viewMode, setViewMode] = useState<'map' | 'cards'>('map') // Default to map view

    const fetchLocations = useCallback(async () => {
        try {
            // Only set loading on initial load or manual refresh, not background refresh
            if (locations.length === 0) setLoading(true)
            
            const res = await fetch('/api/admin/location/live')
            const data = await res.json()
            
            if (data.success) {
                setLocations(data.data)
                setLastUpdated(new Date())
                setError(null)
            } else {
                setError(data.error || 'Failed to fetch locations')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch locations')
        } finally {
            setLoading(false)
        }
    }, []) // Remove locations dependency to avoid infinite loop

    useEffect(() => {
        fetchLocations()
    }, [fetchLocations])

    // Real-time updates via Socket.io
    useEffect(() => {
        if (!socket) return

        // Join the location tracking room
        socket.emit('join:room', 'admin:location')

        const handleLocationUpdate = (data: any) => {
            // console.log('[LiveMap] Received update:', data)
            setLocations(prev => {
                const index = prev.findIndex(p => p.userId === data.userId)
                
                // If user not found, they might be new - trigger fetch
                if (index === -1) {
                    fetchLocations()
                    return prev
                }

                // Update existing user location
                const newLocations = [...prev]
                newLocations[index] = {
                    ...newLocations[index],
                    latitude: data.latitude,
                    longitude: data.longitude,
                    heading: data.heading,
                    isMoving: data.isMoving,
                    batteryLevel: data.batteryLevel,
                    recordedAt: data.recordedAt,
                    accuracy: data.accuracy,
                    speed: data.speed
                }
                
                return newLocations
            })
            setLastUpdated(new Date())
        }

        socket.on('admin:location:update', handleLocationUpdate)

        return () => {
            socket.off('admin:location:update', handleLocationUpdate)
            socket.emit('leave:room', 'admin:location')
        }
    }, [socket, fetchLocations])

    // Filter locations by search
    const filteredLocations = locations.filter(loc => 
        loc.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.siteName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.departmentName?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <HiOutlineMapPin className="w-6 h-6 text-blue-600" />
                            Live Tracking - Lokasi Karyawan
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Pantau lokasi karyawan yang sedang aktif bekerja secara real-time
                        </p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* View Toggle */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('map')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                    viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                <HiOutlineMap className="w-4 h-4" />
                                Map
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                    viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                <HiOutlineSquares2X2 className="w-4 h-4" />
                                Cards
                            </button>
                        </div>
                        {/* Stats Badge */}
                        <div className="flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-full">
                            <HiOutlineUsers className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-800">{locations.length} Aktif</span>
                        </div>
                        
                        {/* Manual Refresh */}
                        <button
                            onClick={fetchLocations}
                            disabled={loading}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <HiOutlineArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
                
                {/* Last Updated */}
                {lastUpdated && (
                    <p className="text-sm text-gray-400 mt-2">
                        Terakhir diperbarui: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: id })}
                    </p>
                )}
            </div>

            {/* Search Bar */}
            <div className="mb-6 relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Cari karyawan, site, atau departemen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Map View */}
            {viewMode === 'map' && (
                <div className="mb-6">
                    <EmployeeLocationMap 
                        locations={filteredLocations} 
                        height={500}
                    />
                </div>
            )}

            {/* Cards View */}
            {viewMode === 'cards' && (
                <>
                    {/* Employee Cards Grid */}
                    {filteredLocations.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                            <HiOutlineUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-600 mb-2">
                                {loading ? 'Memuat...' : 'Tidak Ada Karyawan Aktif'}
                            </h3>
                            <p className="text-gray-400">
                                {loading ? 'Mengambil data lokasi...' : 'Belum ada karyawan yang check-in hari ini'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredLocations.map((loc) => (
                                <div 
                                    key={loc.userId} 
                                    className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition border border-gray-100"
                                >
                                    {/* Header with Avatar */}
                                    <div className="flex items-center gap-3 mb-4">
                                        {loc.userImage ? (
                                            <img 
                                                src={loc.userImage} 
                                                alt={loc.userName} 
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                                <span className="text-white font-bold text-lg">{loc.userName[0]}</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-800 truncate">{loc.userName}</p>
                                            <p className="text-sm text-gray-500 truncate">{loc.departmentName || '-'}</p>
                                        </div>
                                        {loc.isMoving && (
                                            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                <HiOutlineSignal className="w-3 h-3" />
                                                Moving
                                            </span>
                                        )}
                                    </div>

                                    {/* Location Info */}
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <HiOutlineMapPin className="w-4 h-4 text-blue-500" />
                                            <span className="truncate">{loc.siteName || 'Unknown'}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <HiOutlineClock className="w-4 h-4 text-green-500" />
                                            <span>Check-in: {format(new Date(loc.checkInTime), 'HH:mm')}</span>
                                        </div>

                                        {/* Coordinates */}
                                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                                            <span>📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}</span>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                                        <span>
                                            Update: {formatDistanceToNow(new Date(loc.recordedAt), { addSuffix: true, locale: id })}
                                        </span>
                                        {loc.batteryLevel !== null && (
                                            <span className={`px-2 py-1 rounded ${
                                                loc.batteryLevel > 0.5 ? 'bg-green-50 text-green-600' :
                                                loc.batteryLevel > 0.2 ? 'bg-yellow-50 text-yellow-600' :
                                                'bg-red-50 text-red-600'
                                            }`}>
                                                🔋 {Math.round(loc.batteryLevel * 100)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

