'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
    HiOutlineTicket,
    HiOutlineClock,
    HiOutlineCheckCircle
} from 'react-icons/hi2'

export default function HelpdeskDashboard() {
    const { data: session } = useSession()
    const [stats, setStats] = useState({
        openTickets: 0,
        pendingAssignment: 0,
        completedToday: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboardStats()
    }, [])

    const loadDashboardStats = async () => {
        setLoading(true)
        try {
            // TODO: Replace with actual API calls
            // Simulated data for now
            setTimeout(() => {
                setStats({
                    openTickets: 12,
                    pendingAssignment: 3,
                    completedToday: 8,
                })
                setLoading(false)
            }, 500)
        } catch (error) {
            console.error('Error loading dashboard:', error)
            setLoading(false)
        }
    }

    const employee = (session?.user as any)?.employee

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl shadow-lg p-6 md:p-8 text-white">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    Welcome, {employee?.fullName || 'Technician'}!
                </h1>
                <p className="text-blue-100 text-sm md:text-base">
                    {employee?.department?.name} Department
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Open Tickets */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Open Tickets
                        </h3>
                        <HiOutlineTicket className="w-8 h-8 text-red-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.openTickets}</p>
                    )}
                    <Link
                        href="/helpdesk/tickets"
                        className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        View All →
                    </Link>
                </div>



                {/* Completed Today */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Completed Today
                        </h3>
                        <HiOutlineCheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completedToday}</p>
                    )}
                </div>

                {/* Pending Assignment */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Pending
                        </h3>
                        <HiOutlineClock className="w-8 h-8 text-yellow-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingAssignment}</p>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 md:p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <Link
                        href="/helpdesk/tickets"
                        className="group flex flex-col items-center gap-2 p-3 md:p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    >
                        <HiOutlineTicket className="w-6 h-6 md:w-8 md:h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs md:text-sm font-medium text-gray-900 dark:text-white text-center">My Tickets</span>
                    </Link>
                </div>
            </div>

            {/* Info Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    📢 Important Notes
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                    <li>Update ticket status after each customer interaction</li>
                    <li>Upload photos for work order completion verification</li>
                    <li>Contact supervisor for urgent/critical issues</li>
                </ul>
            </div>
        </div>
    )
}
