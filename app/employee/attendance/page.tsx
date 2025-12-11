'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { apiFetch, API_ENDPOINTS } from '@/lib/api-helper'
import { HiOutlineMapPin, HiOutlineClock, HiOutlineCheckCircle, HiOutlineCamera, HiOutlineXMark } from 'react-icons/hi2'
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
    const [photo, setPhoto] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)

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
            const res = await apiFetch(API_ENDPOINTS.EMPLOYEE.ATTENDANCE_TODAY)
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
                error: 'Geolocation tidak didukung oleh browser Anda',
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
                    error: 'Tidak dapat mendapatkan lokasi Anda. Silakan aktifkan layanan lokasi.',
                }))
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        )
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('error', 'Ukuran foto maksimal 5MB')
                return
            }

            setPhoto(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const removePhoto = (e: React.MouseEvent) => {
        e.stopPropagation()
        setPhoto(null)
        setPhotoPreview(null)
        // Reset file input value
        const fileInput = document.getElementById('photo-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
    }

    const uploadPhoto = async (action: string) => {
        if (!photo) return null

        try {
            const formData = new FormData()
            formData.append('photo', photo)
            formData.append('action', action)

            const res = await fetch('/api/employee/attendance/upload-photo', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()
            if (res.ok) {
                return data.data.url
            } else {
                throw new Error(data.error || 'Gagal upload foto')
            }
        } catch (error: any) {
            console.error('Upload photo error:', error)
            showToast('error', error.message || 'Gagal mengupload foto')
            return null
        }
    }

    const handleCheckIn = async () => {
        if (!geolocation.latitude || !geolocation.longitude) {
            showToast('error', 'Lokasi tidak tersedia. Silakan izinkan akses lokasi.')
            return
        }

        setCheckingIn(true)

        try {
            // Upload photo first if exists
            let photoUrl = null
            if (photo) {
                showToast('info', 'Mengupload foto...')
                photoUrl = await uploadPhoto('check-in')
                if (!photoUrl) {
                    setCheckingIn(false)
                    return
                }
            }

            const res = await apiFetch(API_ENDPOINTS.EMPLOYEE.ATTENDANCE_TODAY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check-in',
                    latitude: geolocation.latitude,
                    longitude: geolocation.longitude,
                    photoUrl,
                }),
            })

            const data = await res.json()

            if (res.ok) {
                showToast('success', `Check-in berhasil! Waktu: ${new Date(data.checkInTime).toLocaleTimeString('id-ID')}`)
                setTodayAttendance(data)
                // Clear photo after success
                setPhoto(null)
                setPhotoPreview(null)
            } else {
                showToast('error', data.error || 'Check-in gagal')
            }
        } catch (error) {
            console.error('Check-in error:', error)
            showToast('error', 'Gagal melakukan check-in. Silakan coba lagi.')
        } finally {
            setCheckingIn(false)
        }
    }

    const handleCheckOut = async () => {
        if (!todayAttendance?.attendanceId) {
            showToast('error', 'Tidak ada catatan check-in untuk hari ini')
            return
        }

        if (!geolocation.latitude || !geolocation.longitude) {
            showToast('error', 'Lokasi tidak tersedia. Silakan izinkan akses lokasi.')
            return
        }

        setCheckingOut(true)

        try {
            // Upload photo first if exists
            let photoUrl = null
            if (photo) {
                showToast('info', 'Mengupload foto...')
                photoUrl = await uploadPhoto('check-out')
                if (!photoUrl) {
                    setCheckingOut(false)
                    return
                }
            }

            const res = await apiFetch(API_ENDPOINTS.EMPLOYEE.ATTENDANCE_TODAY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check-out',
                    attendanceId: todayAttendance.attendanceId,
                    latitude: geolocation.latitude,
                    longitude: geolocation.longitude,
                    photoUrl,
                }),
            })

            const data = await res.json()

            if (res.ok) {
                showToast('success', `Check-out berhasil! Waktu: ${new Date(data.checkOutTime).toLocaleTimeString('id-ID')}\nJam Kerja: ${data.workingHours} jam`)
                setTodayAttendance({ ...todayAttendance, checkedOut: true })
                // Clear photo after success
                setPhoto(null)
                setPhotoPreview(null)
            } else {
                showToast('error', data.error || 'Check-out gagal')
            }
        } catch (error) {
            console.error('Check-out error:', error)
            showToast('error', 'Gagal melakukan check-out. Silakan coba lagi.')
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Absensi</h1>
                <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400 mt-2">Check in/out dengan pelacakan lokasi dan foto</p>
            </div>

            {/* Current Time */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 text-center">
                <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 mb-3 sm:mb-2">
                    <HiOutlineClock className="w-6 h-6 sm:w-5 sm:h-5" />
                    <span className="text-base sm:text-sm font-medium">Waktu Saat Ini</span>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-2 font-mono">
                    {timeString}
                </div>
                <div className="text-base sm:text-sm text-gray-600 dark:text-gray-400">
                    {dateString}
                </div>
            </div>

            {/* Ringkasan Hari Ini */}
            {todayAttendance && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold text-green-900 dark:text-green-100 mb-4 sm:mb-3">
                        📊 Ringkasan Hari Ini
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <div className="text-base sm:text-sm text-green-700 dark:text-green-300 mb-1">Check In</div>
                            <div className="text-xl sm:text-lg font-bold text-green-900 dark:text-green-100">
                                {todayAttendance.checkInTime ? new Date(todayAttendance.checkInTime).toLocaleTimeString('id-ID') : '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-base sm:text-sm text-green-700 dark:text-green-300 mb-1">Check Out</div>
                            <div className="text-xl sm:text-lg font-bold text-green-900 dark:text-green-100">
                                {todayAttendance.checkOutTime ? new Date(todayAttendance.checkOutTime).toLocaleTimeString('id-ID') : '-'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Lokasi */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className={`p-3 sm:p-2.5 rounded-full flex-shrink-0 ${geolocation.latitude && geolocation.longitude
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                            <HiOutlineMapPin className={`w-7 h-7 sm:w-6 sm:h-6 ${geolocation.latitude && geolocation.longitude
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                                }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-sm font-medium text-gray-900 dark:text-white">
                                {geolocation.loading ? 'Mendapatkan lokasi...' : 'Status Lokasi'}
                            </p>
                            <p className="text-sm sm:text-xs text-gray-600 dark:text-gray-400 break-words">
                                {geolocation.error ? geolocation.error :
                                    geolocation.latitude && geolocation.longitude
                                        ? `${geolocation.latitude.toFixed(6)}, ${geolocation.longitude.toFixed(6)}`
                                        : 'Lokasi tidak tersedia'}
                            </p>
                        </div>
                    </div>
                    {geolocation.error && (
                        <button
                            onClick={requestGeolocation}
                            className="text-base sm:text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium touch-manipulation min-w-[60px] min-h-[44px] px-3 flex items-center justify-center flex-shrink-0"
                        >
                            Coba Lagi
                        </button>
                    )}
                </div>
            </div>

            {/* Foto Bukti */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                    <HiOutlineCamera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Foto Bukti (Opsional)</h3>
                </div>

                <div
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer ${photoPreview
                        ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                    onClick={() => document.getElementById('photo-upload')?.click()}
                >
                    {photoPreview ? (
                        <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden group">
                            <img src={photoPreview} alt="Preview" className="object-cover w-full h-full" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-sm font-medium">Klik untuk ganti foto</span>
                            </div>
                            <button
                                onClick={removePhoto}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10 shadow-sm"
                            >
                                <HiOutlineXMark className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-3">
                                <HiOutlineCamera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Ambil Foto</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Tap untuk mengambil foto selfie/lokasi
                            </p>
                        </div>
                    )}

                    <input
                        type="file"
                        id="photo-upload"
                        className="hidden"
                        accept="image/*"
                        capture="user"
                        onChange={handlePhotoChange}
                    />
                </div>
            </div>

            {/* Tombol Check In/Out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                    onClick={handleCheckIn}
                    disabled={checkingIn || !geolocation.latitude || todayAttendance?.attendanceId}
                    className="flex flex-col items-center justify-center gap-4 min-h-[140px] sm:min-h-[160px] p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl shadow-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
                >
                    {checkingIn ? (
                        <div className="w-14 h-14 sm:w-12 sm:h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <HiOutlineCheckCircle className="w-14 h-14 sm:w-12 sm:h-12" />
                    )}
                    <div className="text-center">
                        <div className="font-semibold text-lg sm:text-base">Check In</div>
                        <div className="text-sm sm:text-xs opacity-90 mt-1">
                            {checkingIn ? 'Memproses...' : todayAttendance?.attendanceId ? 'Sudah check in' : 'Mulai hari Anda'}
                        </div>
                    </div>
                </button>

                <button
                    onClick={handleCheckOut}
                    disabled={checkingOut || !geolocation.latitude || !todayAttendance?.attendanceId || todayAttendance?.checkedOut}
                    className="flex flex-col items-center justify-center gap-4 min-h-[140px] sm:min-h-[160px] p-6 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl shadow-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
                >
                    {checkingOut ? (
                        <div className="w-14 h-14 sm:w-12 sm:h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <HiOutlineClock className="w-14 h-14 sm:w-12 sm:h-12" />
                    )}
                    <div className="text-center">
                        <div className="font-semibold text-lg sm:text-base">Check Out</div>
                        <div className="text-sm sm:text-xs opacity-90 mt-1">
                            {checkingOut ? 'Memproses...' : !todayAttendance?.attendanceId ? 'Check in terlebih dahulu' : todayAttendance?.checkedOut ? 'Sudah check out' : 'Akhiri hari Anda'}
                        </div>
                    </div>
                </button>
            </div>

            {/* Petunjuk */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5 sm:p-4">
                <h3 className="text-base sm:text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 sm:mb-2">
                    📍 Cara Penggunaan
                </h3>
                <ul className="text-base sm:text-sm text-blue-800 dark:text-blue-200 space-y-2 sm:space-y-1 leading-relaxed">
                    <li>• Izinkan akses lokasi saat diminta</li>
                    <li>• Ambil foto selfie/lokasi sebagai bukti (opsional)</li>
                    <li>• Klik "Check In" saat tiba di tempat kerja</li>
                    <li>• Klik "Check Out" saat pulang</li>
                    <li>• Lokasi Anda akan dicatat secara otomatis</li>
                </ul>
            </div>
        </div>
    )
}
