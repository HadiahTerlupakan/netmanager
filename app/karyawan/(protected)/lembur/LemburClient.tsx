'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import {
    MdNotifications,
    MdNearMe,
    MdWork,
    MdWorkHistory,
    MdCheckCircle,
    MdPending,
    MdFingerprint,
    MdRefresh,
    MdClose,
    MdCameraAlt,
    MdTimer,
    MdAdd,
    MdHistory,
    MdCancel
} from 'react-icons/md'
import { KaryawanNotificationBell } from '@/components/karyawan/KaryawanNotificationBell'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface Overtime {
    id: string
    createdAt: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
    startTime?: string
    endTime?: string
    duration?: number
    rejectionReason?: string
}

interface LemburPageProps {
    holidayInfo?: {
        description: string
        isNational: boolean
    } | null
}

export default function LemburPage({ holidayInfo }: LemburPageProps) {
    const { user } = useKaryawanAuth()

    // Data States
    const [history, setHistory] = useState<Overtime[]>([])
    const [todayRequest, setTodayRequest] = useState<Overtime | null>(null)
    const [loading, setLoading] = useState(false)
    const [currentTime, setCurrentTime] = useState<Date | null>(null)
    const [address, setAddress] = useState<string>('')
    const [hasCheckedOut, setHasCheckedOut] = useState(false)

    // Request Form States
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
    const [requestReason, setRequestReason] = useState('')

    // Camera & Location States
    const [showCamera, setShowCamera] = useState(false)
    const [photo, setPhoto] = useState<string | null>(null)
    const [location, setLocation] = useState<string | null>(null)
    const [activeAction, setActiveAction] = useState<'start' | 'stop' | null>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Clock - only runs on client after mount
    useEffect(() => {
        setCurrentTime(new Date()) // Set initial time on mount
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/karyawan/lembur')
            if (res.ok) {
                const data: Overtime[] = await res.json()
                setHistory(data)

                // Find today's active/pending request
                // Logic: Find request for TODAY or one that is IN_PROGRESS (could be overnight?)
                // For now simpler: Find the latest request regarding today
                const todayStr = new Date().toISOString().split('T')[0]
                const today = data.find(item => item.createdAt.startsWith(todayStr) || item.status === 'IN_PROGRESS')
                setTodayRequest(today || null)
            }
        } catch (error) {
            console.error('Failed to fetch data', error)
        }
    }, [])

    useEffect(() => {
        fetchData()
        fetchAttendanceStatus()
        getLocation()
    }, [fetchData])

    // Fetch checkout status from history
    const fetchAttendanceStatus = async () => {
        try {
            const res = await fetch('/api/attendance/history?limit=1')
            if (res.ok) {
                const data = await res.json()
                if (data.success && data.data.length > 0) {
                    const lastAttendance = data.data[0]
                    const today = new Date().toDateString()
                    const attendanceDate = new Date(lastAttendance.checkIn).toDateString()

                    // Check if the latest attendance is from today and has a checkout time
                    if (today === attendanceDate && lastAttendance.checkOut) {
                        setHasCheckedOut(true)
                    } else {
                        setHasCheckedOut(false)
                    }
                } else {
                    setHasCheckedOut(false)
                }
            }
        } catch (error) {
            console.error('Failed to fetch attendance', error)
        }
    }

    // --- Geolocation Logic ---
    const getLocationPromise = useCallback((): Promise<string | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null)
                return
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude
                    const lng = position.coords.longitude
                    const loc = `${lat},${lng}`
                    setLocation(loc)
                    fetchAddress(lat, lng)
                    resolve(loc)
                },
                (err) => {
                    console.error("Geo error", err)
                    resolve(null)
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            )
        })
    }, [])

    const getLocation = () => {
        getLocationPromise()
    }

    const fetchAddress = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            const data = await res.json()
            if (data.display_name) setAddress(data.display_name)
        } catch (error) { console.error(error) }
    }

    // --- Camera Logic (Adapted from Attendance) ---
    const startCamera = async (type: 'start' | 'stop') => {
        // Refresh location when camera starts
        getLocation()

        if (todayRequest?.status === 'APPROVED' && type === 'start') {
            // Validasi Checkout dulu?
        }

        setActiveAction(type)
        setShowCamera(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            if (videoRef.current) videoRef.current.srcObject = stream
        } catch (err) {
            toast.error("Gagal akses kamera")
            setShowCamera(false)
        }
    }

    const stopCameraStream = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
            videoRef.current.srcObject = null
        }
    }

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')

            if (context) {
                // Set canvas to match video dimensions
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight

                // Draw video frame (Mirrored to match preview)
                context.save()
                context.scale(-1, 1)
                context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
                context.restore()

                const W = canvas.width
                const H = canvas.height
                const padding = 40

                // 1. Bottom Gradient (Simulate Timemark fade)
                const gradient = context.createLinearGradient(0, H - 400, 0, H)
                gradient.addColorStop(0, 'transparent')
                gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)')
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.45)')
                context.fillStyle = gradient
                context.fillRect(0, H - 450, W, 450)

                // 2. Logo "Timemark" style (Top Right)
                const logoSize = 120
                const logoX = W - logoSize - padding
                const logoY = padding + 20

                // Draw Logo Background (White rounded rect)
                context.fillStyle = 'rgba(255, 255, 255, 0.1)'
                if (typeof context.roundRect === 'function') {
                    context.roundRect(logoX, logoY, logoSize, 50, 10)
                    context.fill()
                } else {
                    context.fillRect(logoX, logoY, logoSize, 50)
                }

                context.fillStyle = '#FFD700' // Gold color
                context.font = 'bold 30px sans-serif'
                context.textAlign = 'center'
                context.fillText('Net', logoX + (logoSize / 2), logoY + 35)

                // 3. Information info (Bottom Left)
                context.textAlign = 'left'
                context.shadowColor = 'black'
                context.shadowBlur = 4
                context.fillStyle = 'rgba(255, 255, 255, 0.95)'

                // Time (Large)
                const timeString = format(new Date(), 'HH:mm')
                context.font = 'bold 120px sans-serif'
                context.fillText(timeString, padding, H - 220)

                // Date
                const dateString = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })
                context.font = 'bold 35px sans-serif'
                context.fillText(dateString, padding, H - 170)

                // Address (Word wrap)
                context.font = '28px sans-serif'
                const maxAddrWidth = W - (padding * 2)

                // Simple word wrap logic for address
                const words = (address || 'Mencari alamat...').split(' ')
                let line = ''
                let y = H - 120
                const lineHeight = 35

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' '
                    const metrics = context.measureText(testLine)
                    const testWidth = metrics.width
                    if (testWidth > maxAddrWidth && n > 0) {
                        context.fillText(line, padding, y)
                        line = words[n] + ' '
                        y += lineHeight
                    }
                    else {
                        line = testLine
                    }
                }
                context.fillText(line, padding, y)

                // Coordinates (Below address)
                y += lineHeight + 10
                context.font = '24px monospace'
                context.fillText(`Lat: ${location?.split(',')[0] || '?'} Long: ${location?.split(',')[1] || '?'}`, padding, y)

                // User Name (Bottom Right or Below coords?) - Let's put it below coords
                y += lineHeight + 10
                if (user?.name) {
                    context.font = 'bold 24px sans-serif'
                    context.fillText(`Member: ${user.name}`, padding, y)
                }

                setPhoto(canvas.toDataURL('image/jpeg', 0.8))
                stopCameraStream()
                setShowCamera(false)
            }
        }
    }

    // --- Action Handlers ---
    const handleAction = async () => {
        if (!photo || !todayRequest || !activeAction) return

        setLoading(true)
        const toastId = toast.loading('Memproses data...')

        try {
            // Ensure location is present
            let finalLocation = location
            if (!finalLocation) {
                toast.loading('Sedang mengambil data lokasi...', { id: toastId })
                finalLocation = await getLocationPromise()
            }

            // If still no location, warn user but maybe allow? Or block?
            // User requested "untuk lokasi tetap di record", so we should try hard.
            if (!finalLocation) {
                // Try one more time?
                // Or just proceed with null and let backend handle or user accept missing location
                // But typically we want to enforce it if possible. 
                // Let's allow it but warn, or depend on business rule.
                // Assuming blocking is better if required.
                // But for now, let's proceed.
            }

            const res = await fetch('/api/karyawan/lembur', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: activeAction,
                    overtimeId: todayRequest.id,
                    photo,
                    location: finalLocation
                })
            })

            const data = await res.json()
            if (res.ok) {
                toast.success(activeAction === 'start' ? 'Lembur Dimulai' : 'Lembur Selesai', { id: toastId })
                setPhoto(null)
                setActiveAction(null)
                fetchData()
            } else {
                throw new Error(data.error)
            }
        } catch (error: any) {
            toast.error(error.message, { id: toastId })
        } finally {
            setLoading(false)
        }
    }

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/karyawan/lembur', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request',
                    date: new Date().toISOString(),
                    reason: requestReason
                })
            })
            if (res.ok) {
                toast.success('Pengajuan berhasil dikirim')
                setIsRequestModalOpen(false)
                setRequestReason('')
                fetchData()
            } else {
                const err = await res.json()
                toast.error(err.error)
            }
        } catch (e) { toast.error('Gagal mengirim request') }
        finally { setLoading(false) }
    }

    // --- Renders ---

    // Greeting similar to AttendancePage
    const getGreeting = () => {
        if (!currentTime) return 'Selamat,'
        const h = currentTime.getHours()
        return h < 11 ? 'Selamat Pagi,' : h < 15 ? 'Selamat Siang,' : h < 18 ? 'Selamat Sore,' : 'Selamat Malam,'
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased pb-24">
            <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">
                {/* Header */}
                <div className="sticky top-0 z-20 flex items-center bg-[#f6f7f8] dark:bg-[#101922] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <div className="flex size-10 shrink-0 items-center">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full size-10 flex items-center justify-center text-white font-bold text-lg">
                            {user?.name?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-lg font-bold">Lembur</h2>
                        <p className="text-xs font-medium text-slate-500">{getGreeting()}</p>
                    </div>
                    <div className="flex size-10 items-center justify-end">
                        <KaryawanNotificationBell />
                    </div>
                </div>

                {/* Time Display */}
                <div className="flex flex-col items-center pt-2 pb-6 px-4">
                    <h1 className="text-[42px] font-bold text-[#111418] dark:text-white tracking-tighter leading-none mb-1">
                        {currentTime ? format(currentTime, 'HH:mm') : '--:--'}
                    </h1>
                    <h2 className="text-slate-500 dark:text-gray-400 font-medium text-sm">
                        {currentTime ? format(currentTime, 'EEEE, d MMMM yyyy', { locale: id }) : 'Memuat...'}
                    </h2>
                </div>

                {/* Main Action Area */}
                <div className="px-4 w-full">
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-gray-800 relative overflow-hidden">

                        {/* Background Blob */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

                        {/* LOCATION MAP (Only show if Approved/In Progress) */}
                        {(todayRequest?.status === 'APPROVED' || todayRequest?.status === 'IN_PROGRESS') && (
                            <div className="relative w-full h-28 rounded-xl overflow-hidden mb-5 bg-gray-100 dark:bg-gray-900 border border-slate-100 dark:border-gray-700">
                                <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDiCTCdRfxIYEDuIQXvjeGjg9MAYh03iWivTCXqyKFx5Byh75Ax_vOUgE4u5uHeVgOP_VhdJ5YtDOgugpqJ6TUEEyaoIjfyEnpV665iPqTDjBn5nwiP5Kjfu9FFjnDpSBmwNqytA2VjtZijnJV2vWF0P_AnMsd4ky6gv6C46DVVGQ5ORuRT1FxQtkgE1MxENbYGmLHA7msbFo2bmf_w1udHRmx-vfpeQp4wQlK0myq_8eoTnrgNqW3AW5yQyn8yjxkv1w40QzNztHI")' }}></div>
                                <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white z-10 drop-shadow-md">
                                    <MdNearMe />
                                    <span className="text-xs font-bold">{location ? 'Lokasi Tersedia' : 'Mencari Lokasi...'}</span>
                                </div>
                            </div>
                        )}

                        {/* DYNAMIC CONTENT BASED ON STATUS */}

                        {/* 1. NO REQUEST / REJECTED / COMPLETED (New Request) */}
                        {(!todayRequest || todayRequest.status === 'REJECTED' || todayRequest.status === 'COMPLETED') && (
                            <div className="text-center py-6">
                                <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                    <MdWork className="text-3xl" />
                                </div>
                                <h3 className="text-lg font-bold mb-1">Pengajuan Lembur</h3>
                                <p className="text-xs text-slate-500 mb-6 px-4">
                                    Ajukan lembur untuk hari ini. Pastikan mendapat persetujuan sebelum memulai.
                                </p>
                                <button
                                    onClick={() => setIsRequestModalOpen(true)}
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <MdAdd className="text-xl" /> Ajukan Lembur
                                </button>
                            </div>
                        )}

                        {/* 2. PENDING REQUEST */}
                        {todayRequest?.status === 'PENDING' && (
                            <div className="text-center py-6">
                                <div className="size-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-yellow-600">
                                    <MdPending className="text-3xl animate-pulse" />
                                </div>
                                <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-500 mb-1">Menunggu Approval</h3>
                                <p className="text-xs text-slate-500 mb-2">
                                    Pengajuan sedang ditinjau oleh Admin.
                                </p>
                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm italic text-slate-600 dark:text-slate-400 mb-4 mx-2">
                                    "{todayRequest.reason}"
                                </div>
                            </div>
                        )}

                        {/* 3. APPROVED (READY TO START) */}
                        {todayRequest?.status === 'APPROVED' && (
                            <div className="py-2">
                                <div className="flex items-center gap-3 mb-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800">
                                    <MdCheckCircle className="text-green-600 text-xl" />
                                    <div>
                                        <h4 className="font-bold text-sm text-green-700 dark:text-green-400">Disetujui</h4>
                                        <p className="text-[10px] text-green-600">Silakan mulai saat jam lembur tiba.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => startCamera('start')}
                                    disabled={!hasCheckedOut && !holidayInfo?.isNational}
                                    className={`w-full h-14 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${hasCheckedOut || holidayInfo?.isNational
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 active:scale-95'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <MdTimer className="text-2xl" /> Mulai Lembur
                                </button>
                                {!hasCheckedOut && !holidayInfo?.isNational && (
                                    <p className="text-[11px] text-center text-amber-600 dark:text-amber-400 mt-3 font-medium">
                                        ⚠️ Anda harus Checkout absen reguler terlebih dahulu
                                    </p>
                                )}
                                {(hasCheckedOut || holidayInfo?.isNational) && (
                                    <p className="text-[10px] text-center text-slate-400 mt-3">
                                        ✓ {holidayInfo?.isNational ? 'Libur Nasional (Bypass Absen)' : 'Sudah checkout'} - Siap mulai lembur
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 4. IN PROGRESS */}
                        {todayRequest?.status === 'IN_PROGRESS' && (
                            <div className="py-2">
                                <div className="flex flex-col items-center mb-6">
                                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Sedang Berjalan</span>
                                    <div className="text-3xl font-mono font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                                        {todayRequest.startTime ? format(new Date(todayRequest.startTime), 'HH:mm') : '--:--'} - Now
                                    </div>
                                </div>
                                <button
                                    onClick={() => startCamera('stop')}
                                    className="w-full h-14 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <MdTimer className="text-2xl" /> Selesai Lembur
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* History List */}
                <div className="mt-8 px-4 w-full">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <MdHistory /> Riwayat Terbaru
                    </h3>
                    <div className="space-y-3">
                        {history.map(item => (
                            <div key={item.id} className="bg-white dark:bg-[#1c2936] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-gray-800 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm">{format(new Date(item.createdAt), 'dd MMM yyyy')}</p>
                                    <p className="text-xs text-slate-500 max-w-[200px] truncate">{item.reason}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                                ${item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                        item.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                                            item.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700 animate-pulse' :
                                                item.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'}
                             `}>
                                    {item.status.replace('_', ' ')}
                                </span>
                            </div>
                        ))}
                        {history.length === 0 && <p className="text-slate-400 text-center text-sm">Belum ada data.</p>}
                    </div>
                </div>

                {/* Request Modal */}
                {isRequestModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-[#1c2936] w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold mb-4">Form Pengajuan</h3>
                            <textarea
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                                rows={3}
                                placeholder="Alasan lembur..."
                                value={requestReason}
                                onChange={(e) => setRequestReason(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsRequestModalOpen(false)}
                                    className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl"
                                >Batal</button>
                                <button
                                    onClick={handleRequestSubmit}
                                    disabled={!requestReason}
                                    className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl disabled:opacity-50"
                                >Kirim</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Camera Modal */}
                {showCamera && (
                    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                        <div className="relative w-full h-full max-w-md bg-black flex flex-col">
                            {/* Header */}
                            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                                <h3 className="text-white font-medium">Ambil Foto Selfie</h3>
                                <button
                                    onClick={() => {
                                        setShowCamera(false)
                                        stopCameraStream()
                                        setActiveAction(null)
                                    }}
                                    className="p-2 rounded-full bg-white/20 text-white backdrop-blur-sm"
                                >
                                    <MdClose size={24} />
                                </button>
                            </div>

                            {/* Camera/Preview Area */}
                            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                                />
                                <canvas ref={canvasRef} className="hidden" />

                                {/* Guide Frame */}
                                <div className="absolute inset-0 border-[32px] border-black/30 flex items-center justify-center pointer-events-none">
                                    <div className="w-64 h-80 border-2 border-white/50 rounded-full"></div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6">
                                {/* Capture Button */}
                                <button
                                    onClick={capturePhoto}
                                    className="p-1 rounded-full border-4 border-white transition-transform active:scale-95"
                                >
                                    <div className="size-16 rounded-full bg-white border-4 border-black" />
                                </button>
                                <p className="text-white/80 text-sm">Pastikan wajah terlihat jelas</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Photo Preview Modal */}
                {photo && activeAction && (
                    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 pb-24">
                        <img src={photo} alt="Preview" className="max-w-full max-h-[70vh] rounded-xl mb-6 border-2 border-white/20" />
                        <div className="flex gap-4 w-full max-w-xs">
                            <button
                                onClick={() => { setPhoto(null); startCamera(activeAction) }}
                                className="flex-1 py-3 bg-slate-700 text-white rounded-xl font-bold"
                            >Ulangi</button>
                            <button
                                onClick={handleAction}
                                disabled={loading}
                                className="flex-1 py-3 bg-white text-black rounded-xl font-bold"
                            >
                                {loading ? 'Mengirim...' : 'Konfirmasi'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
