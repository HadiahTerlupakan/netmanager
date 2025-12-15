'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBack,
    MdEdit,
    MdMail,
    MdChevronRight,
    MdCall,
    MdLocationOn,
    MdLock,
    MdVerifiedUser,
    MdReceiptLong,
    MdCampaign,
    MdLanguage,
    MdLogout
} from 'react-icons/md'

interface ProfileData {
    idPelanggan: string
    nama: string
    username: string
    email: string | null
    noTelp: string | null
    alamat: string | null
    status: string
    lokasi: {
        provinsi: string | null
        kabupatenKota: string | null
        kecamatan: string | null
        kelurahanDesa: string | null
    }
    preferences: {
        is2FAEnabled: boolean
        isBillNotifEnabled: boolean
        isPromoEnabled: boolean
    }
}

export default function CustomerProfilPage() {
    const { isLoading: authLoading, isAuthenticated, logout } = useCustomerAuth()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    // State handles for toggles (Visual only for now as API might not support them yet)
    const [is2FAEnabled, setIs2FAEnabled] = useState(false)
    const [isBillNotifEnabled, setIsBillNotifEnabled] = useState(true)
    const [isPromoEnabled, setIsPromoEnabled] = useState(false)

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchProfile()
        }
    }, [isAuthenticated])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/customer/profile')
            const data = await res.json()
            if (data.success) {
                setProfile(data.profile)
                if (data.profile.preferences) {
                    setIs2FAEnabled(data.profile.preferences.is2FAEnabled)
                    setIsBillNotifEnabled(data.profile.preferences.isBillNotifEnabled)
                    setIsPromoEnabled(data.profile.preferences.isPromoEnabled)
                }
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggle = async (key: 'is2FAEnabled' | 'isBillNotifEnabled' | 'isPromoEnabled', currentValue: boolean) => {
        const newValue = !currentValue
        // Optimistic update
        if (key === 'is2FAEnabled') setIs2FAEnabled(newValue)
        if (key === 'isBillNotifEnabled') setIsBillNotifEnabled(newValue)
        if (key === 'isPromoEnabled') setIsPromoEnabled(newValue)

        try {
            const res = await fetch('/api/customer/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: newValue })
            })
            if (!res.ok) throw new Error('Failed to update')
        } catch (error) {
            console.error('Failed to update preference:', error)
            // Revert on error
            if (key === 'is2FAEnabled') setIs2FAEnabled(!newValue)
            if (key === 'isBillNotifEnabled') setIsBillNotifEnabled(!newValue)
            if (key === 'isPromoEnabled') setIsPromoEnabled(!newValue)
        }
    }

    const handleLogout = async () => {
        await logout()
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="p-6 text-center text-gray-500">Gagal memuat data</div>
        )
    }

    const fullAddress = [
        profile.alamat,
        profile.lokasi.kelurahanDesa,
        profile.lokasi.kecamatan,
        profile.lokasi.kabupatenKota,
        profile.lokasi.provinsi,
    ].filter(Boolean).join(', ') || 'Alamat belum diatur'

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white transition-colors duration-200">
            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] pb-24">

                {/* Top App Bar */}
                <div className="sticky top-0 z-10 flex items-center bg-[#f6f7f8]/95 dark:bg-[#101922]/95 p-4 pb-2 justify-between backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-900 dark:text-white"
                    >
                        <MdArrowBack className="text-2xl" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">Pengaturan Akun</h2>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col items-center pt-6 pb-6 px-4">
                    <div className="relative mb-4">
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-24 w-24 border-4 border-white dark:border-gray-700 shadow-md"
                            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC5CSzYuHLaqvmYa8lBplFGRvKgHiAtXRbTArIc14idsDgp7bVGWepxzP4MWldTWCMGUMCv1YjC0M4pClCyqMzAt4QaIsbXLm9m_a6LSIAoXSUlQtXb9tEUQTOMY-ifRod6e1UbS345BpgAo_j9q7tOJtzYHhu34j0uhdhuKx0TL_DS1axfgcAZfidBwMPPTF0K6L6Cmtqva9keLQahZbkSji_6M1B6PDJGeLvGkZzZTxsYp7OdM_k8HheOLRNSyXQZ8aNdnFU8Q_c")' }}
                        ></div>
                        <button className="absolute bottom-0 right-0 bg-[#0d9488] text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-gray-800 flex items-center justify-center">
                            <MdEdit className="text-[16px]" />
                        </button>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <p className="text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] text-center">{profile.nama}</p>
                        <p className="text-[#617589] dark:text-gray-400 text-sm font-medium leading-normal text-center mt-1">ID Pelanggan: {profile.idPelanggan}</p>
                    </div>
                </div>

                {/* Section: Data Diri */}
                <div className="px-4 mt-2">
                    <h3 className="text-[#617589] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 pb-2">Data Diri</h3>
                    <div className="bg-white dark:bg-[#1e293b] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                        {/* Email Item */}
                        <div className="flex items-center gap-3 p-4 justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdMail className="text-[20px]" />
                                </div>
                                <div className="flex flex-col truncate">
                                    <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal truncate">Email</p>
                                    <p className="text-[#617589] dark:text-gray-400 text-xs truncate">{profile.email || '-'}</p>
                                </div>
                            </div>
                            <div className="shrink-0 text-gray-400 dark:text-gray-500">
                                <MdChevronRight className="text-[20px]" />
                            </div>
                        </div>
                        {/* Phone Item */}
                        <div className="flex items-center gap-3 p-4 justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdCall className="text-[20px]" />
                                </div>
                                <div className="flex flex-col truncate">
                                    <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal truncate">No. Handphone</p>
                                    <p className="text-[#617589] dark:text-gray-400 text-xs truncate">{profile.noTelp || '-'}</p>
                                </div>
                            </div>
                            <div className="shrink-0 text-gray-400 dark:text-gray-500">
                                <MdChevronRight className="text-[20px]" />
                            </div>
                        </div>
                        {/* Address Item */}
                        <div className="flex items-center gap-3 p-4 justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdLocationOn className="text-[20px]" />
                                </div>
                                <div className="flex flex-col truncate">
                                    <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal truncate">Alamat</p>
                                    <p className="text-[#617589] dark:text-gray-400 text-xs truncate">{fullAddress}</p>
                                </div>
                            </div>
                            <div className="shrink-0 text-gray-400 dark:text-gray-500">
                                <MdChevronRight className="text-[20px]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section: Keamanan */}
                <div className="px-4 mt-6">
                    <h3 className="text-[#617589] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 pb-2">Keamanan</h3>
                    <div className="bg-white dark:bg-[#1e293b] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                        {/* Change Password */}
                        <div className="flex items-center gap-3 p-4 justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdLock className="text-[20px]" />
                                </div>
                                <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal flex-1 truncate">Ganti Password</p>
                            </div>
                            <div className="shrink-0 text-gray-400 dark:text-gray-500">
                                <MdChevronRight className="text-[20px]" />
                            </div>
                        </div>
                        {/* 2FA Toggle */}
                        <div className="flex items-center gap-3 p-4 justify-between cursor-pointer" onClick={() => handleToggle('is2FAEnabled', is2FAEnabled)}>
                            <div className="flex items-center gap-3">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdVerifiedUser className="text-[20px]" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal">Verifikasi 2 Langkah</p>
                                </div>
                            </div>
                            <div className="shrink-0 relative inline-flex items-center cursor-pointer">
                                <div className={`w-11 h-6 rounded-full peer transition-colors ${is2FAEnabled ? 'bg-[#0d9488]' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 shadow-sm transition-transform ${is2FAEnabled ? 'translate-x-full border-white' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section: Preferensi */}
                <div className="px-4 mt-6">
                    <h3 className="text-[#617589] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider px-2 pb-2">Preferensi</h3>
                    <div className="bg-white dark:bg-[#1e293b] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                        {/* Bill Notifications Toggle */}
                        <div className="flex items-center gap-3 p-4 justify-between border-b border-gray-100 dark:border-gray-700 cursor-pointer" onClick={() => handleToggle('isBillNotifEnabled', isBillNotifEnabled)}>
                            <div className="flex items-center gap-3">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdReceiptLong className="text-[20px]" />
                                </div>
                                <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal">Notifikasi Tagihan</p>
                            </div>
                            <div className="shrink-0 relative inline-flex items-center cursor-pointer">
                                <div className={`w-11 h-6 rounded-full peer transition-colors ${isBillNotifEnabled ? 'bg-[#0d9488]' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 shadow-sm transition-transform ${isBillNotifEnabled ? 'translate-x-full border-white' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                        {/* Promo Toggle */}
                        <div className="flex items-center gap-3 p-4 justify-between border-b border-gray-100 dark:border-gray-700 cursor-pointer" onClick={() => handleToggle('isPromoEnabled', isPromoEnabled)}>
                            <div className="flex items-center gap-3">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdCampaign className="text-[20px]" />
                                </div>
                                <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal">Promo & Penawaran</p>
                            </div>
                            <div className="shrink-0 relative inline-flex items-center cursor-pointer">
                                <div className={`w-11 h-6 rounded-full peer transition-colors ${isPromoEnabled ? 'bg-[#0d9488]' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 shadow-sm transition-transform ${isPromoEnabled ? 'translate-x-full border-white' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                        {/* Language Item */}
                        <div className="flex items-center gap-3 p-4 justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="text-[#0d9488] flex items-center justify-center rounded-lg bg-[#0d9488]/10 shrink-0 size-9">
                                    <MdLanguage className="text-[20px]" />
                                </div>
                                <p className="text-[#111418] dark:text-white text-sm font-medium leading-normal">Bahasa</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[#617589] dark:text-gray-400 text-sm">Indonesia</span>
                                <div className="shrink-0 text-gray-400 dark:text-gray-500">
                                    <MdChevronRight className="text-[20px]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-4 mt-8 flex flex-col gap-4">
                    <button
                        onClick={handleLogout}
                        className="w-full bg-white dark:bg-[#1e293b] text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 font-bold py-3.5 px-4 rounded-xl shadow-sm active:bg-red-50 dark:active:bg-red-900/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <MdLogout className="text-[20px]" />
                        Keluar Akun
                    </button>
                    <p className="text-center text-xs text-gray-400 dark:text-gray-600 font-medium">Versi Aplikasi 2.4.0 (Build 302)</p>
                </div>
                <div className="h-10"></div>
            </div>
        </div>
    )
}
