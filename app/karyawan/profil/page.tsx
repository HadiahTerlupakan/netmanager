'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdLogout,
    MdEmail,
    MdBusiness,
    MdLocationOn
} from 'react-icons/md'
import Link from 'next/link'

export default function ProfilPage() {
    const { isLoading: authLoading, isAuthenticated, user, logout } = useKaryawanAuth()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await logout()
    }

    const [siteName, setSiteName] = useState<string | null>(null)

    useEffect(() => {
        if (isAuthenticated && user?.siteId) {
            fetch('/api/attendance/config')
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch')
                    return res.json()
                })
                .then(data => {
                    if (data.data?.site?.name) {
                        setSiteName(data.data.site.name)
                    } else if (data.site?.name) {
                        // Fallback for flat structure if changed
                        setSiteName(data.site.name)
                    } else {
                        // Data retrieved but no name?
                        console.warn('Site data found but no name:', data)
                    }
                })
                .catch(err => {
                    console.error('Error fetching site name:', err)
                    setSiteName('Gagal memuat')
                })
        } else if (isAuthenticated && !user?.siteId) {
            // confirmed no site
            setSiteName(null)
        }
    }, [isAuthenticated, user?.siteId])

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased">
            <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 justify-between">
                        <Link href="/karyawan/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight">Profil</h2>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Profile Card */}
                <div className="px-4 pt-6">
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                            {user?.name?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                        <h2 className="text-xl font-bold dark:text-white">{user?.name || 'Karyawan'}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user?.email}</p>
                    </div>
                </div>

                {/* Info */}
                <div className="px-4 pt-4">
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                        <div className="flex items-center gap-4 p-4">
                            <MdEmail className="text-2xl text-gray-400" />
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                                <p className="font-medium dark:text-white">{user?.email || '-'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4">
                            <MdBusiness className="text-2xl text-gray-400" />
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                                <p className="font-medium dark:text-white">{user?.departmentId ? 'Ada' : 'Belum diatur'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4">
                            <MdLocationOn className="text-2xl text-gray-400" />
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Site</p>
                                <p className="font-medium dark:text-white">{siteName || (user?.siteId ? 'Memuat...' : 'Belum diatur')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logout */}
                <div className="px-4 pt-6 pb-24">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-4 px-4 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2 border border-red-100 dark:border-red-800"
                    >
                        <MdLogout className="text-xl" />
                        {isLoggingOut ? 'Keluar...' : 'Keluar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
