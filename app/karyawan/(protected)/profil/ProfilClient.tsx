'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdLogout,
    MdEmail,
    MdBusiness,
    MdLocationOn
} from 'react-icons/md'
import { KaryawanNotificationBell } from '@/components/karyawan/KaryawanNotificationBell'

export default function ProfilPage() {
    const { isLoading: authLoading, isAuthenticated, user, logout } = useKaryawanAuth()
    const [profileData, setProfileData] = useState<{
        departments?: { name: string } | null
        sites?: { name: string } | null
        workingHourMode?: 'FIXED' | 'FLEXIBLE' | 'SHIFT'
        startWorkTime?: string | null
        endWorkTime?: string | null
        workDays?: string | null
    } | null>(null)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetch('/api/karyawan/me')
                .then(res => res.json())
                .then(data => {
                    if (data.data) {
                        setProfileData(data.data)
                    }
                })
                .catch(err => console.error('Error fetching profile:', err))
        }
    }, [isAuthenticated])

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await logout()
    }

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
                <div className="sticky top-0 z-20 flex items-center bg-[#f6f7f8] dark:bg-[#101922] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <div className="flex size-10 shrink-0 items-center">
                        <div className="bg-linear-to-br from-blue-500 to-blue-700 rounded-full size-10 flex items-center justify-center text-white font-bold text-lg">
                            {user?.name?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#111418] dark:text-white">Profil</h2>
                    </div>
                    <div className="flex size-10 items-center justify-end">
                        <KaryawanNotificationBell />
                    </div>
                </div>

                {/* Profile Card */}
                <div className="px-4 pt-6">
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
                        <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
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
                                <p className="font-medium dark:text-white">{profileData?.departments?.name || 'Belum diatur'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4">
                            <MdLocationOn className="text-2xl text-gray-400" />
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Site</p>
                                <p className="font-medium dark:text-white">{profileData?.sites?.name || 'Belum diatur'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4">
                            <div className="flex flex-col w-full">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Jam Kerja</p>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 w-full">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {profileData?.workingHourMode === 'FLEXIBLE' ? 'Flexible' : 'Fixed'}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                            {profileData?.workingHourMode || 'FIXED'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {profileData?.workingHourMode === 'FIXED' ? (
                                            <>
                                                <div>{profileData?.startWorkTime || '09:00'} - {profileData?.endWorkTime || '17:00'}</div>
                                                <div className="text-xs text-gray-500 mt-1">{profileData?.workDays || 'Mon,Tue,Wed,Thu,Fri'}</div>
                                            </>
                                        ) : (
                                            <div>Jam kerja fleksibel</div>
                                        )}
                                    </div>
                                </div>
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
