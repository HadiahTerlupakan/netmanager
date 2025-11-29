'use client'

import { useState, useEffect } from 'react'
import { HiOutlineUsers, HiOutlineClock, HiOutlineCalendar, HiOutlineBanknotes, HiOutlineTrendingUp } from 'react-icons/hi2'

export default function HRISDashboard() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // TODO: Fetch real stats from API
        setStats({
            totalEmployees: 0,
            activeEmployees: 0,
            todayPresent: 0,
            todayAbsent: 0,
            pendingLeaves: 0,
        })
        setLoading(false)
    }, [])

    if (loading) {
        return <div>Loading...</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HRIS Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Human Resource Information System - Overview
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Employees</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {stats?.activeEmployees || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                            <HiOutlineUsers className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Present Today</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                                {stats?.todayPresent || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <HiOutlineClock className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Absent Today</p>
                            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                                {stats?.todayAbsent || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <HiOutlineClock className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pending Leaves</p>
                            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                                {stats?.pendingLeaves || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                            <HiOutlineCalendar className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a
                        href="/admin/hris/employees/new"
                        className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                    >
                        <HiOutlineUsers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-gray-900 dark:text-white font-medium">Add New Employee</span>
                    </a>
                    <a
                        href="/admin/hris/attendance"
                        className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                    >
                        <HiOutlineClock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-gray-900 dark:text-white font-medium">View Attendance</span>
                    </a>
                    <a
                        href="/admin/hris/payroll"
                        className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                    >
                        <HiOutlineBanknotes className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-gray-900 dark:text-white font-medium">Process Payroll</span>
                    </a>
                </div>
            </div>

            {/* Alert: Getting Started */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    🎉 Welcome to HRIS Module!
                </h3>
                <p className="text-blue-800 dark:text-blue-200 mb-4">
                    The HRIS module is now active. Start by adding employees and setting up departments.
                </p>
                <div className="flex gap-3">
                    <a
                        href="/admin/hris/employees"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        Manage Employees
                    </a>
                    <a
                        href="/admin/hris/departments"
                        className="px-4 py-2 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Setup Departments
                    </a>
                </div>
            </div>
        </div>
    )
}
