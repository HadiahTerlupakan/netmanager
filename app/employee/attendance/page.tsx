'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HiOutlineMapPin, HiOutlineClock, HiOutlineCheckCircle } from 'react-icons/hi2'
import { useToast } from '@/components/ui/Toast'
import { AttendanceCardSkeleton } from '@/components/ui/LoadingSkeleton'

interface GeolocationState {
    latitude: number | null
    longitude: number | null
    error: string | null
    loading: boolean
}

export default function EmployeeAttendancePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { showToast } = useToast()
    const [todayAttendance, setTodayAttendance] = useState<any>(null)
    const [geolocation, setGeolocation] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        error: null,
        loading: false,
    })
    const [checkingIn, setCheckingIn] = useState(false)
    const [checkingOut, setCheckingOut] = useState(false)
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/employee/login')
        } else if (status === 'authenticated') {
            requestGeolocation()
            checkTodayAttendance()
        }
    }, [status, router])

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    const checkTodayAttendance = async () => {
        try {
            const res = await fetch('/api/hris/attendance/today')
            if (res.ok) {
                const data = await res.json()
                setTodayAttendance(data.attendance)
            }
        } catch (error) {
            console.error('Error checking attendance:', error)
        }
    }

    const requestGeolocation = () => {
        setGeolocation(prev => ({ ...prev, loading: true, error: null }))

        if (!navigator.geolocation) {
            setGeolocation(prev => ({
                ...prev,
                loading: false,
                error: 'Geolocation is not supported by your browser',
            }))
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setGeolocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    error: null,
                    loading: false,
                })
            },
            (error) => {
                setGeolocation(prev => ({
                    ...prev,
                    loading: false,
                    error: 'Unable to get your location. Please enable location services.',
                }))
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        )
    }

    const handleCheckIn = async () => {
        if (!geolocation.latitude || !geolocation.longitude) {
            showToast('error', 'Location not available. Please allow location access.')
            return
        }

        setCheckingIn(true)

        try {
            const res = await fetch('/api/hris/attendance/check-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitude: geolocation.latitude,
                    longitude: geolocation.longitude,
                }),
            })

            const data = await res.json()

            if (res.ok) {
                showToast('success', `Check-in successful! Time: ${new Date(data.checkInTime).toLocaleTimeString('id-ID')}`)
                setTodayAttendance(data)
            } else {
                showToast('error', data.error || 'Check-in failed')
            }
        } catch (error) {
            console.error('Check-in error:', error)
            showToast('error', 'Failed to check in. Please try again.')
        } finally {
            setCheckingIn(false)
        }
    }

    const handleCheckOut = async () => {
        if (!todayAttendance?.attendanceId) {
            showToast('error', 'No check-in record found for today')
            return
        }

        if (!geolocation.latitude || !geolocation.longitude) {
            showToast('error', 'Location not available. Please allow location access.')
            return
        }

        setCheckingOut(true)

        try {
            const res = await fetch('/api/hris/attendance/check-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attendanceId: todayAttendance.attendanceId,
                    latitude: geolocation.latitude,
                    longitude: geolocation.longitude,
                }),
            })

            const data = await res.json()

            if (res.ok) {
                showToast('success', `Check-out successful! Time: ${new Date(data.checkOutTime).toLocaleTimeString('id-ID')}\nWorking Hours: ${data.workingHours} hours`)
                setTodayAttendance({ ...todayAttendance, checkedOut: true })
            } else {
                showToast('error', data.error || 'Check-out failed')
            }
        } catch (error) {
            console.error('Check-out error:', error)
            showToast('error', 'Failed to check out. Please try again.')
        } finally {
            setCheckingOut(false)
        }
    }

    if (status === 'loading') {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2 animate-pulse" />
                    <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                </div>
                <AttendanceCardSkeleton />
            </div>
        )
    }

    const timeString = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const dateString = currentTime.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Attendance</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Check in/out with location tracking</p>
            </div>

            {/* Current Time */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
                <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                    <HiOutlineClock className="w-6 h-6" />
                    <span className="text-sm font-medium">Current Time</span>
                </div>
                <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2 font-mono">
                    {timeString}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                    {dateString}
                </div>
            </div>

            {/* Todaysummary */}
            {todayAttendance && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
                        📊 Today's Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-green-700 dark:text-green-300">Check In</div>
                            <div className="text-lg font-bold text-green-900 dark:text-green-100">
                                {todayAttendance.checkInTime ? new Date(todayAttendance.checkInTime).toLocaleTimeString('id-ID') : '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-green-700 dark:text-green-300">Check Out</div>
                            <div className="text-lg font-bold text-green-900 dark:text-green-100">
                                {todayAttendance.checkOutTime ? new Date(todayAttendance.checkOutTime).toLocaleTimeString('id-ID') : '-'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Geolocation Status */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${geolocation.latitude && geolocation.longitude
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                            <HiOutlineMapPin className={`w-6 h-6 ${geolocation.latitude && geolocation.longitude
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                                }`} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {geolocation.loading ? 'Getting location...' : 'Location Status'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {geolocation.error ? geolocation.error :
                                    geolocation.latitude && geolocation.longitude
                                        ? `${geolocation.latitude.toFixed(6)}, ${geolocation.longitude.toFixed(6)}`
                                        : 'Location not available'}
                            </p>
                        </div>
                    </div>
                    {geolocation.error && (
                        <button
                            onClick={requestGeolocation}
                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                            Retry
                        </button>
                    )}
                </div>
            </div>

            {/* Check In/Out Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={handleCheckIn}
                    disabled={checkingIn || !geolocation.latitude || todayAttendance?.attendanceId}
                    className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl shadow-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <HiOutlineCheckCircle className="w-12 h-12" />
                    <div>
                        <div className="font-semibold">Check In</div>
                        <div className="text-xs opacity-90">
                            {checkingIn ? 'Processing...' : todayAttendance?.attendanceId ? 'Already checked in' : 'Start your day'}
                        </div>
                    </div>
                </button>

                <button
                    onClick={handleCheckOut}
                    disabled={checkingOut || !geolocation.latitude || !todayAttendance?.attendanceId || todayAttendance?.checkedOut}
                    className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl shadow-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <HiOutlineClock className="w-12 h-12" />
                    <div>
                        <div className="font-semibold">Check Out</div>
                        <div className="text-xs opacity-90">
                            {checkingOut ? 'Processing...' : !todayAttendance?.attendanceId ? 'Check in first' : todayAttendance?.checkedOut ? 'Already checked out' : 'End your day'}
                        </div>
                    </div>
                </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    📍 How it works
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Allow location access when prompted</li>
                    <li>• Click "Check In" when you arrive at work</li>
                    <li>• Click "Check Out" when you leave</li>
                    <li>• Your location will be recorded automatically</li>
                </ul>
            </div>
        </div>
    )
}
