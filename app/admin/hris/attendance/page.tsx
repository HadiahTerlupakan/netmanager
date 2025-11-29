'use client'

import { useState, useEffect } from 'react'
import { HiOutlineClock, HiOutlineMapPin, HiOutlineCalendar } from 'react-icons/hi2'

interface Attendance {
    id: string
    date: string
    checkInTime: string | null
    checkInLat: number | null
    checkInLng: number | null
    checkOutTime: string | null
    checkOutLat: number | null
    checkOutLng: number | null
    workingHours: number | null
    status: string
    employee: {
        id: string
        employeeId: string
        fullName: string
        department?: {
            name: string
        } | null
    }
}

export default function AttendancePage() {
    const [attendances, setAttendances] = useState<Attendance[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [summary, setSummary] = useState({ present: 0, late: 0, absent: 0, leave: 0 })

    useEffect(() => {
        fetchAttendances()
    }, [selectedDate])

    const fetchAttendances = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/hris/attendance?date=${selectedDate}`)
            const data = await res.json()

            if (res.ok) {
                setAttendances(data.attendances || [])

                // Calculate summary
                const summary = {
                    present: data.attendances?.filter((a: Attendance) => a.status === 'PRESENT').length || 0,
                    late: data.attendances?.filter((a: Attendance) => a.status === 'LATE').length || 0,
                    absent: data.attendances?.filter((a: Attendance) => a.status === 'ABSENT').length || 0,
                    leave: data.attendances?.filter((a: Attendance) => a.status === 'LEAVE').length || 0,
                }
                setSummary(summary)
            }
        } catch (error) {
            console.error('Error fetching attendance:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            LEAVE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            SICK_LEAVE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            PERMISSION: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
            REMOTE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
        }

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        )
    }

    const formatTime = (time: string | null) => {
        if (!time) return '-'
        return new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Track employee attendance and working hours
                </p>
            </div>

            {/* Date Picker */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <HiOutlineCalendar className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Date:</span>
                    </div>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Present</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                                {summary.present}
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <HiOutlineClock className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Late</p>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                                {summary.late}
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                            <HiOutlineClock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Absent</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                                {summary.absent}
                            </p>
                        </div>
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <HiOutlineClock className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Leave</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                {summary.leave}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <HiOutlineClock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading attendance...</p>
                    </div>
                ) : attendances.length === 0 ? (
                    <div className="p-8 text-center">
                        <HiOutlineClock className="mx-auto w-12 h-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No attendance records</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            No attendance data for {new Date(selectedDate).toLocaleDateString('id-ID')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Employee
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Department
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Check In
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Check Out
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Working Hours
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Location
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {attendances.map((attendance) => (
                                    <tr key={attendance.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {attendance.employee.fullName}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {attendance.employee.employeeId}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {attendance.employee.department?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {formatTime(attendance.checkInTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {formatTime(attendance.checkOutTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {attendance.workingHours?.toFixed(2) || '-'} hrs
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(attendance.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {attendance.checkInLat && attendance.checkInLng ? (
                                                <a
                                                    href={`https://www.google.com/maps?q=${attendance.checkInLat},${attendance.checkInLng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                                    title="View on map"
                                                >
                                                    <HiOutlineMapPin className="w-4 h-4" />
                                                    <span className="text-xs">View</span>
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
