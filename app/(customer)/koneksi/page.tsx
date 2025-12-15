'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBackIos,
    MdRefresh,
    MdDownload,
    MdUpload,
    MdSensors,
    MdSpeed,
    MdPowerSettingsNew,
    MdBuild,
    MdLightbulb,
    MdHome,
    MdRouter,
    MdReceiptLong,
    MdPerson
} from 'react-icons/md'

export default function CustomerConnectionPage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const [data, setData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchUsage()
        }
    }, [isAuthenticated])

    const fetchUsage = async () => {
        try {
            const res = await fetch('/api/customer/usage')
            const json = await res.json()
            if (json.success) {
                setData(json)
            }
        } catch (error) {
            console.error('Failed to fetch usage:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleRefresh = () => {
        setIsLoading(true)
        fetchUsage()
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const isOnline = data?.connection?.isOnline ?? false
    const ipAddress = data?.connection?.ipAddress ?? '-'
    const uptime = data?.connection?.sessionDurationFormatted ?? '0j 0m'
    const downloadSpeed = '150' // Placeholder as API might not return real-time speed yet
    const uploadSpeed = '50'   // Placeholder
    const ping = '12'          // Placeholder

    return (
        <div className="bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white transition-colors duration-200 min-h-screen">
            <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-20 max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922]">

                {/* Top App Bar */}
                <div className="sticky top-0 z-10 flex items-center bg-white dark:bg-[#1c2b3e] p-4 pb-2 justify-between border-b border-[#e5e7eb] dark:border-gray-700 shadow-sm">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-900 dark:text-white"
                    >
                        <MdArrowBackIos className="text-2xl" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Status Koneksi</h2>
                    <div className="flex w-12 items-center justify-end">
                        <button
                            onClick={handleRefresh}
                            className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-transparent text-[#111418] dark:text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0"
                        >
                            <MdRefresh className={`text-2xl ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex flex-col gap-4 p-4">

                    {/* Connection Status Card */}
                    <div className="@container">
                        <div className="flex flex-col items-stretch justify-start rounded-xl shadow-sm bg-white dark:bg-[#1c2b3e] overflow-hidden border border-gray-100 dark:border-gray-800">
                            {/* Status Header with Image */}
                            <div className="relative w-full h-32 bg-[#0d9488]/10">
                                <div
                                    className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-80 mix-blend-multiply"
                                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA1zbuSiG_aFEYgjz6Y0qNcZ1fjc5ifvzXP2wN8p00uNF473dWDnN3D1bYEh-4jQHMdvxIWmb_MPiFa38IN_spQkTJinOjapZ1gi-6IqfAqsl535Oa_eGE11LEYdWT4A-3y1x_4l9HB2ZUI029DZS3TG1TK7I08v7AtQN58V9_tiJX0RE-VDgAh0GyatJehVkwmMQekhkvaQkc2rDYgI3UfdFMYs5dmCeKf1AgnJR__VXXtejC4hzA3e0FPTv1Nf3G6CrbySo2cLhw")' }}
                                ></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#1c2b3e] to-transparent"></div>
                                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                                    <div className={`size-3 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-[#111418] dark:text-white text-sm font-semibold bg-white/80 dark:bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                        {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                            {/* Status Details */}
                            <div className="flex w-full grow flex-col gap-1 p-5 pt-2">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-[#617589] dark:text-gray-400 text-xs font-medium uppercase tracking-wider">Status Saat Ini</p>
                                        <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight mt-1">
                                            {isOnline ? 'Terhubung' : 'Terputus'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[#617589] dark:text-gray-400 text-xs font-medium">Uptime</p>
                                        <p className="text-[#111418] dark:text-white text-sm font-bold">{uptime}</p>
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>
                                <div className="flex items-center gap-3 justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[#617589] dark:text-gray-400 text-xs">IP Address</span>
                                        <span className="text-[#111418] dark:text-white text-sm font-medium font-mono">{ipAddress}</span>
                                    </div>
                                    <button className="flex cursor-pointer items-center justify-center rounded-lg h-8 px-4 bg-[#0d9488]/10 hover:bg-[#0d9488]/20 text-[#0d9488] dark:text-teal-400 text-sm font-medium leading-normal transition-colors">
                                        <span className="truncate">Detail Perangkat</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-2 rounded-xl p-4 bg-white dark:bg-[#1c2b3e] shadow-sm border border-[#dbe0e6] dark:border-gray-800">
                            <div className="flex items-center gap-2 text-[#617589] dark:text-gray-400">
                                <MdDownload className="text-[20px]" />
                                <p className="text-xs font-medium uppercase">Down</p>
                            </div>
                            <div>
                                <p className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight">{downloadSpeed}</p>
                                <p className="text-[#617589] dark:text-gray-400 text-xs">Mbps</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-4 bg-white dark:bg-[#1c2b3e] shadow-sm border border-[#dbe0e6] dark:border-gray-800">
                            <div className="flex items-center gap-2 text-[#617589] dark:text-gray-400">
                                <MdUpload className="text-[20px]" />
                                <p className="text-xs font-medium uppercase">Up</p>
                            </div>
                            <div>
                                <p className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight">{uploadSpeed}</p>
                                <p className="text-[#617589] dark:text-gray-400 text-xs">Mbps</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-4 bg-white dark:bg-[#1c2b3e] shadow-sm border border-[#dbe0e6] dark:border-gray-800">
                            <div className="flex items-center gap-2 text-[#617589] dark:text-gray-400">
                                <MdSensors className="text-[20px]" />
                                <p className="text-xs font-medium uppercase">Ping</p>
                            </div>
                            <div>
                                <p className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight">{ping}</p>
                                <p className="text-[#617589] dark:text-gray-400 text-xs">ms</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <button className="group flex flex-col gap-3 rounded-xl border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1c2b3e] p-4 items-start shadow-sm active:scale-95 transition-transform">
                            <div className="p-2 rounded-full bg-[#0d9488]/10 text-[#0d9488] dark:text-teal-400 group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
                                <MdSpeed className="text-2xl" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-[#111418] dark:text-white text-base font-bold leading-tight">Tes Kecepatan</h2>
                                <p className="text-xs text-[#617589] dark:text-gray-400 mt-1">Cek performa jaringan</p>
                            </div>
                        </button>
                        <button className="group flex flex-col gap-3 rounded-xl border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1c2b3e] p-4 items-start shadow-sm active:scale-95 transition-transform">
                            <div className="p-2 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                <MdPowerSettingsNew className="text-2xl" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-[#111418] dark:text-white text-base font-bold leading-tight">Restart Router</h2>
                                <p className="text-xs text-[#617589] dark:text-gray-400 mt-1">Perbaiki masalah ringan</p>
                            </div>
                        </button>
                    </div>

                    {/* Diagnosis Panel */}
                    <div className="@container">
                        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[#dbe0e6] dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-[#1c2b3e] dark:to-[#15202e] p-5 shadow-sm">
                            <div className="flex gap-4 items-start">
                                <div className="rounded-full bg-teal-100 p-2 text-[#0d9488] dark:bg-teal-900/30 dark:text-teal-400 shrink-0">
                                    <MdBuild className="text-2xl" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="text-[#111418] dark:text-white text-base font-bold leading-tight">Diagnosa Otomatis</p>
                                    <p className="text-[#617589] dark:text-gray-400 text-sm font-normal leading-normal">Deteksi masalah dan optimalkan koneksi Anda secara otomatis.</p>
                                </div>
                            </div>
                            <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#0d9488] hover:bg-teal-600 text-white text-sm font-bold leading-normal transition-colors">
                                <span className="truncate">Mulai Diagnosa</span>
                            </button>
                        </div>
                    </div>

                    {/* Help/Tips Section */}
                    <div className="rounded-xl bg-teal-50 dark:bg-teal-900/10 p-4 border border-teal-100 dark:border-teal-900/30">
                        <div className="flex items-start gap-3">
                            <MdLightbulb className="text-[#0d9488] dark:text-teal-400 mt-0.5 text-xl" />
                            <div>
                                <p className="text-sm font-bold text-[#111418] dark:text-white mb-1">Tips Koneksi</p>
                                <p className="text-sm text-[#617589] dark:text-gray-400 leading-relaxed">
                                    Jika internet terasa lambat, cobalah mendekat ke router atau matikan perangkat yang tidak digunakan.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Spacer */}
                    <div className="h-12"></div>
                </div>

                {/* Bottom Navigation Bar */}
                <div className="fixed bottom-0 left-0 right-0 border-t border-[#e5e7eb] dark:border-gray-800 bg-white dark:bg-[#1c2b3e] px-6 py-2 pb-5 z-50">
                    <div className="flex justify-between items-end">
                        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-[#617589] dark:text-gray-400 hover:text-[#0d9488] transition-colors">
                            <MdHome className="text-2xl" />
                            <span className="text-[10px] font-medium">Beranda</span>
                        </Link>
                        <Link href="/koneksi" className="flex flex-col items-center gap-1 text-[#0d9488] dark:text-[#0d9488]">
                            <MdRouter className="text-2xl" />
                            <span className="text-[10px] font-bold">Koneksi</span>
                        </Link>
                        <Link href="/riwayat" className="flex flex-col items-center gap-1 text-[#617589] dark:text-gray-400 hover:text-[#0d9488] transition-colors">
                            <MdReceiptLong className="text-2xl" />
                            <span className="text-[10px] font-medium">Tagihan</span>
                        </Link>
                        <Link href="/profil" className="flex flex-col items-center gap-1 text-[#617589] dark:text-gray-400 hover:text-[#0d9488] transition-colors">
                            <MdPerson className="text-2xl" />
                            <span className="text-[10px] font-medium">Akun</span>
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    )
}
