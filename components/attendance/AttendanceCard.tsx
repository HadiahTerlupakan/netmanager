'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { FaCamera, FaCheck, FaSignOutAlt, FaMapMarkerAlt, FaSpinner } from 'react-icons/fa'

export default function AttendanceCard() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [checkingStatus, setCheckingStatus] = useState(true)
    const [status, setStatus] = useState<'idle' | 'checked-in' | 'checked-out'>('idle')
    const [attendanceId, setAttendanceId] = useState<string | null>(null)
    const [checkInTime, setCheckInTime] = useState<string | null>(null)
    const [checkOutTime, setCheckOutTime] = useState<string | null>(null)

    const [showCamera, setShowCamera] = useState(false)
    const [photo, setPhoto] = useState<string | null>(null)
    const [location, setLocation] = useState<string | null>(null)
    const [notes, setNotes] = useState('')

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/attendance/history?limit=1')
            const data = await res.json()

            if (data.success && data.data.length > 0) {
                const lastAttendance = data.data[0]
                const today = new Date().toDateString()
                const attendanceDate = new Date(lastAttendance.checkIn).toDateString()

                if (today === attendanceDate) {
                    setAttendanceId(lastAttendance.id)
                    setCheckInTime(new Date(lastAttendance.checkIn).toLocaleTimeString())

                    if (lastAttendance.checkOut) {
                        setStatus('checked-out')
                        setCheckOutTime(new Date(lastAttendance.checkOut).toLocaleTimeString())
                    } else {
                        setStatus('checked-in')
                    }
                } else {
                    setStatus('idle')
                }
            } else {
                setStatus('idle')
            }
        } catch (error) {
            console.error('Failed to fetch attendance status', error)
            toast.error('Gagal memuat status absensi')
        } finally {
            setCheckingStatus(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    const startCamera = async () => {
        setShowCamera(true)
        setPhoto(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch (err) {
            console.error("Error accessing camera", err)
            toast.error("Gagal mengakses kamera. Pastikan izin diberikan.")
            setShowCamera(false)
        }
    }

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream
            stream.getTracks().forEach(track => track.stop())
            videoRef.current.srcObject = null
        }
        setShowCamera(false)
    }

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d')
            if (context) {
                // Set canvas dimensions to match video
                canvasRef.current.width = videoRef.current.videoWidth
                canvasRef.current.height = videoRef.current.videoHeight

                // Draw video frame to canvas
                context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)

                // Convert to base64
                const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8)
                setPhoto(dataUrl)
                stopCamera()
            }
        }
    }

    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation(`${position.coords.latitude},${position.coords.longitude}`)
                    toast.success('Lokasi berhasil didapatkan')
                },
                (error) => {
                    console.error("Error getting location", error)
                    toast.error("Gagal mendapatkan lokasi")
                }
            )
        } else {
            toast.error("Browser tidak mendukung geolocation")
        }
    }

    const handleSubmit = async () => {
        if (!photo) {
            toast.error('Foto selfie wajib diambil')
            return
        }

        setLoading(true)

        try {
            // Convert base64 to file
            const res = await fetch(photo)
            const blob = await res.blob()
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" })

            const formData = new FormData()
            formData.append('photo', file)
            if (notes) formData.append('notes', notes)
            if (location) formData.append('location', location)

            const endpoint = status === 'idle' ? '/api/attendance/check-in' : '/api/attendance/check-out'

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Terjadi kesalahan')
            }

            toast.success(status === 'idle' ? 'Check-in berhasil!' : 'Check-out berhasil!')
            setPhoto(null)
            setNotes('')
            await fetchStatus()

            // Delay agar user dapat melihat pesan sukses
            await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (checkingStatus) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse h-64 flex items-center justify-center">
                <FaSpinner className="animate-spin text-4xl text-blue-500" />
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FaCheck className="text-green-500" /> Absensi Harian
            </h2>

            <div className="flex flex-col gap-4">
                {/* Status Display */}
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Jam Masuk</p>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{checkInTime || '-'}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Jam Keluar</p>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{checkOutTime || '-'}</p>
                    </div>
                </div>

                {/* Action Area */}
                {status !== 'checked-out' && (
                    <div className="space-y-4 border-t pt-4 dark:border-gray-700">
                        {/* Camera Preview */}
                        {showCamera && (
                            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                <button
                                    onClick={capturePhoto}
                                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black rounded-full p-4 shadow-lg hover:bg-gray-100 transition"
                                >
                                    <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                                </button>
                            </div>
                        )}

                        <canvas ref={canvasRef} className="hidden" />

                        {/* Photo Preview */}
                        {photo && !showCamera && (
                            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                                <Image src={photo} alt="Selfie Preview" fill className="object-cover" />
                                <button
                                    onClick={() => setPhoto(null)}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full text-xs"
                                >
                                    Ulang
                                </button>
                            </div>
                        )}

                        {/* Controls */}
                        {!showCamera && !photo && (
                            <button
                                onClick={startCamera}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition"
                            >
                                <FaCamera /> Ambil Foto Selfie
                            </button>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={getLocation}
                                className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded flex items-center justify-center gap-2 text-sm transition"
                            >
                                <FaMapMarkerAlt /> {location ? 'Lokasi Tersimpan' : 'Ambil Lokasi'}
                            </button>
                        </div>

                        <textarea
                            placeholder="Catatan (opsional)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            rows={2}
                        />

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !photo}
                            className={`w-full py-3 rounded-lg font-bold text-white transition ${loading || !photo
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : status === 'idle'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-orange-600 hover:bg-orange-700'
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2"><FaSpinner className="animate-spin" /> Memproses...</span>
                            ) : status === 'idle' ? (
                                'Check In'
                            ) : (
                                <span className="flex items-center justify-center gap-2"><FaSignOutAlt /> Check Out</span>
                            )}
                        </button>

                        {!photo && (
                            <p className="text-xs text-center text-red-500">* Foto selfie wajib diisi</p>
                        )}
                    </div>
                )}

                {status === 'checked-out' && (
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                        <FaCheck className="mx-auto text-2xl mb-2" />
                        <p className="font-medium">Absensi hari ini selesai</p>
                    </div>
                )}
            </div>
        </div>
    )
}
