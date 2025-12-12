"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PageLoader from '@/components/ui/PageLoader'
import { HiUserGroup, HiBriefcase } from 'react-icons/hi2'

interface TechStat {
    name: string
    totalTasks: number
    avgResponseTime: string
    avgResolutionTime: string
}

interface AdminStat {
    name: string
    totalCreated: number
    avgDispatchTime: string
    avgSupportResponseTime: string
}

export default function KPIDashboardPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<{ technicianStats: TechStat[], adminStats: AdminStat[] } | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (status === 'authenticated') {
            fetchStats()
        }
    }, [status, router])

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/kpi/kpi-stats')
            if (response.ok) {
                const result = await response.json()
                setStats(result.data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatDuration = (minutesStr: string) => {
        const minutes = parseFloat(minutesStr)
        if (isNaN(minutes)) return '-'
        if (minutes < 60) return `${minutes}m`
        const hours = Math.floor(minutes / 60)
        const mins = Math.round(minutes % 60)
        return `${hours}h ${mins}m`
    }

    if (loading) return <div className="flex justify-center min-h-screen pt-20"><PageLoader /></div>

    return (
        <div className="space-y-8 p-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">KPI Dashboard</h1>
                <p className="text-gray-600">Employee performance metrics and response times.</p>
            </div>

            {/* Technicians */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                    <HiUserGroup className="w-5 h-5 text-sky-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Technician Performance</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                            <tr>
                                <th className="px-6 py-3">Employee</th>
                                <th className="px-6 py-3">Completed Tasks</th>
                                <th className="px-6 py-3">Avg Response Time (Start)</th>
                                <th className="px-6 py-3">Avg Resolution Time (Finish)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats?.technicianStats.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No data available</td>
                                </tr>
                            )}
                            {stats?.technicianStats.map((stat, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{stat.name}</td>
                                    <td className="px-6 py-4">{stat.totalTasks}</td>
                                    <td className="px-6 py-4 text-sky-600 font-medium">
                                        {formatDuration(stat.avgResponseTime)}
                                    </td>
                                    <td className="px-6 py-4 text-green-600 font-medium">
                                        {formatDuration(stat.avgResolutionTime)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Admins */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                    <HiBriefcase className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Admin Performance</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                            <tr>
                                <th className="px-6 py-3">Admin</th>
                                <th className="px-6 py-3">Work Orders Created</th>
                                <th className="px-6 py-3">Avg Dispatch Time (Ticket → WO)</th>
                                <th className="px-6 py-3">Avg Support Response (Reply)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats?.adminStats.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No data available</td>
                                </tr>
                            )}
                            {stats?.adminStats.map((stat, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{stat.name}</td>
                                    <td className="px-6 py-4">{stat.totalCreated}</td>
                                    <td className="px-6 py-4 text-orange-600 font-medium">
                                        {formatDuration(stat.avgDispatchTime)}
                                    </td>
                                    <td className="px-6 py-4 text-indigo-600 font-medium">
                                        {formatDuration(stat.avgSupportResponseTime)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                <p className="font-semibold mb-1">Metrics Definitions:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Response Time: Time between Work Order Creation and Technician Start.</li>
                    <li>Resolution Time: Time between Technician Start and Completion.</li>
                    <li>Dispatch Time: Time between Ticket Creation and Work Order Creation.</li>
                    <li>Support Response Time: Average time taken to reply to a comment on a Work Order.</li>
                </ul>
            </div>
        </div>
    )
}
