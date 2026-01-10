'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBack,
    MdWifi,
    MdFileDownload,
    MdFileUpload,
    MdBadge,
    MdCalendarToday,
    MdRouter,
    MdLocationOn,
    MdSpeed,
    MdSupportAgent
} from 'react-icons/md'
import Link from 'next/link'

interface PackageData {
    profile: {
        nama: string
        idPelanggan: string
        status: string
        alamat: string
        jatuhTempo: string
        paket: {
            nama: string
            harga: number
            bandwidth: { download: string; upload: string } | null
        } | null
    }
}

export default function CustomerPaketPage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const [data, setData] = useState<PackageData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchData()
        }
    }, [isAuthenticated])

    const fetchData = async () => {
        try {
            const res = await fetch('/api/customer/profile')
            const json = await res.json()
            if (json.success) {
                setData(json)
            }
        } catch (error) {
            console.error('Failed to fetch package data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getPeriodString = (jatuhTempo: string) => {
        if (!jatuhTempo) return '-'
        const due = new Date(jatuhTempo)
        const start = new Date(due)
        start.setMonth(start.getMonth() - 1)
        return `${start.toLocaleDateString('id-ID', { day: 'numeric' })} - ${due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (!data || !data.profile) {
        return <div className="p-6 text-center text-gray-500">Gagal memuat data</div>
    }

    const { profile } = data
    const { paket } = profile
    const isAktif = profile.status === 'AKTIF'

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-gray-900 dark:text-white transition-colors duration-200">
            <div className="relative flex min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <header className="flex items-center justify-between bg-white dark:bg-[#1a2632] p-4 sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-900 dark:text-white"
                    >
                        <MdArrowBack className="text-2xl" />
                    </button>
                    <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Detail Layanan</h2>
                </header>

                <main className="flex-1 flex flex-col p-4 gap-4 pb-24">
                    {/* Hero Card */}
                    <div className="rounded-2xl bg-white dark:bg-[#1a2632] shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                        <div className="relative w-full h-40 bg-[#0d9488]/10 overflow-hidden">
                            {/* Abstract Background Pattern */}
                            <div
                                className="absolute inset-0 opacity-20"
                                style={{ backgroundImage: 'radial-gradient(#0d9488 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                            ></div>
                            <div className="absolute right-[-20px] top-[-20px] opacity-10">
                                <MdWifi className="text-[180px] text-[#0d9488]" />
                            </div>
                            <div className="absolute bottom-4 left-4 z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${isAktif
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                        }`}>
                                        <span className={`size-1.5 rounded-full ${isAktif ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'}`}></span>
                                        {profile.status === 'AKTIF' ? 'Aktif' : 'Non-Aktif'}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    {paket?.nama || 'Belum Berlangganan'}
                                </h3>
                            </div>
                        </div>

                        <div className="p-4 flex flex-col gap-4">
                            <div className="flex items-end justify-between border-b border-gray-100 dark:border-gray-700 pb-4">
                                <div className="flex flex-col gap-1">
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Biaya Bulanan</p>
                                    <p className="text-[#0d9488] text-xl font-bold">
                                        Rp {(paket?.harga || 0).toLocaleString('id-ID')}
                                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">/ bln</span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Kuota</p>
                                    <span className="font-semibold text-gray-900 dark:text-white">Unlimited Fiber</span>
                                </div>
                            </div>

                            {/* Stats inside card for quick glance */}
                            {paket?.bandwidth && (
                                <div className="flex gap-4">
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-[#0d9488]">
                                            <MdFileDownload className="text-2xl" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Download</p>
                                            <p className="text-base font-bold text-gray-900 dark:text-white">{paket.bandwidth.download}</p>
                                        </div>
                                    </div>
                                    <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                            <MdFileUpload className="text-2xl" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Upload</p>
                                            <p className="text-base font-bold text-gray-900 dark:text-white">{paket.bandwidth.upload}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detail Information List */}
                    <div className="rounded-2xl bg-white dark:bg-[#1a2632] shadow-sm p-5 border border-gray-100 dark:border-gray-800">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Informasi Pelanggan</h4>
                        <div className="flex flex-col gap-5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <MdBadge className="text-gray-400 text-xl" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">ID Pelanggan</p>
                                </div>
                                <p className="text-gray-900 dark:text-white text-sm font-medium text-right">{profile.idPelanggan}</p>
                            </div>
                            <div className="w-full h-px bg-gray-50 dark:bg-gray-700/50"></div>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <MdCalendarToday className="text-gray-400 text-xl" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Periode Tagihan</p>
                                </div>
                                <p className="text-gray-900 dark:text-white text-sm font-medium text-right">{getPeriodString(profile.jatuhTempo)}</p>
                            </div>
                            <div className="w-full h-px bg-gray-50 dark:bg-gray-700/50"></div>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <MdRouter className="text-gray-400 text-xl" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Jenis IP Address</p>
                                </div>
                                <p className="text-gray-900 dark:text-white text-sm font-medium text-right">Dynamic Public</p>
                            </div>
                            <div className="w-full h-px bg-gray-50 dark:bg-gray-700/50"></div>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <MdLocationOn className="text-gray-400 text-xl" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Alamat Pemasangan</p>
                                </div>
                                <p className="text-gray-900 dark:text-white text-sm font-medium text-right max-w-[50%]">{profile.alamat}</p>
                            </div>
                        </div>
                    </div>

                    {/* Promo Banner (Optional) */}
                    <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-teal-600 to-teal-700 p-4 text-white shadow-lg">
                        <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-teal-100">Rekomendasi untukmu</p>
                                <p className="text-lg font-bold">Upgrade ke 200 Mbps?</p>
                                <p className="text-xs text-teal-100 mt-1">Hanya tambah Rp 50rb/bln</p>
                            </div>
                            <Link href="/upgrade-paket">
                                <button className="shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-bold text-white transition-colors">
                                    Lihat
                                </button>
                            </Link>
                        </div>
                    </div>
                </main>

                {/* Fixed Bottom Actions */}
                <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-[#1a2632] p-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-3 z-40 pb-6">
                    <Link href="/upgrade-paket" className="w-full">
                        <button className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 px-5 bg-[#0d9488] hover:bg-teal-600 text-white text-base font-bold leading-normal tracking-[0.015em] transition-all shadow-md shadow-teal-500/20 active:scale-[0.98]">
                            <MdSpeed className="mr-2 text-[20px]" />
                            <span>Upgrade Speed</span>
                        </button>
                    </Link>
                    <Link href="/dukungan" className="w-full">
                        <button className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-base font-semibold leading-normal tracking-[0.015em] transition-all active:scale-[0.98]">
                            <MdSupportAgent className="mr-2 text-[20px] text-gray-500" />
                            <span>Lapor Gangguan</span>
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
