"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiClipboardDocumentList, HiClock, HiCheckCircle, HiWrenchScrewdriver, HiChevronRight, HiExclamationCircle, HiUserGroup, HiChartBar, HiBuildingOffice2, HiArchiveBoxArrowDown } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

type Statistics = { total: number; pending: number; assigned: number; inProgress: number; onHold: number; completed: number; verified: number; closed: number; cancelled: number; urgentOpen: number; avgCompletionTimeHours: number; totalCost: number; avgRating: number | null; totalWithRating: number }
type WorkOrder = { id: string; workOrderNumber: string; title: string; status: string; priority: string; type: string; contactName?: string | null; pelanggan?: { nama: string } | null; assignedTo: { fullName: string } | null; department: { name: string } | null; createdAt: string }
type DepartmentWorkload = { departmentName: string; total: number; pending: number; inProgress: number; completed: number }
type TopPerformer = { employeeName: string; count: number; avgCompletionTime: number }
type IssueStatistic = { issue: string; count: number }
type SiteStatistic = { siteName: string; count: number; mostCommonIssue: string }

type DisconnectionStatistic = { reason: string; count: number }

const STATUS_COLORS: Record<string, string> = { PENDING: 'bg-orange-100 text-orange-800', ASSIGNED: 'bg-yellow-100 text-yellow-800', IN_PROGRESS: 'bg-blue-100 text-blue-800', COMPLETED: 'bg-green-100 text-green-800', VERIFIED: 'bg-green-100 text-green-800' }
const PRIORITY_COLORS: Record<string, string> = { LOW: 'bg-gray-100 text-gray-600', NORMAL: 'bg-blue-100 text-blue-600', HIGH: 'bg-orange-100 text-orange-600', URGENT: 'bg-red-100 text-red-600', CRITICAL: 'bg-red-200 text-red-800' }

export default function WorkOrderDashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Statistics | null>(null)
    const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([])
    const [departmentWorkload, setDepartmentWorkload] = useState<DepartmentWorkload[]>([])
    const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
    const [issueStats, setIssueStats] = useState<IssueStatistic[]>([])
    const [siteStats, setSiteStats] = useState<SiteStatistic[]>([])
    const [disconnectionStats, setDisconnectionStats] = useState<DisconnectionStatistic[]>([])
    const [performancePeriod, setPerformancePeriod] = useState<string>('all_time')

    useEffect(() => { if (status === 'unauthenticated') { router.push('/login'); return } if (session?.user && status === 'authenticated') fetchDashboardData() }, [session, status, router])

    useEffect(() => {
        if (session?.user && status === 'authenticated') {
            fetchDetailedStats()
        }
    }, [performancePeriod, session, status])

    const fetchDashboardData = async () => {
        try {
            const [statsRes, recentRes, workloadRes] = await Promise.all([
                fetch('/api/admin/workorders/stats'),
                fetch('/api/admin/workorders/recent'),
                fetch('/api/admin/workorders/department-workload')
            ])
            if (statsRes.ok) { const result = await statsRes.json(); setStats(result.data) }
            if (recentRes.ok) { const result = await recentRes.json(); setRecentWorkOrders(result.data) }
            if (workloadRes.ok) { const result = await workloadRes.json(); setDepartmentWorkload(result.data) }
            // Initial fetch handled by effect
            fetchDetailedStats()
        } catch (error) { console.error('Error fetching dashboard data:', error) }
        finally { setLoading(false) }
    }

    const fetchDetailedStats = async () => {
        try {
            const [performersRes, analyticsRes] = await Promise.all([
                fetch(`/api/admin/workorders/top-performers?period=${performancePeriod}`),
                fetch(`/api/admin/workorders/analytics?period=${performancePeriod}`)
            ])

            if (performersRes.ok) {
                const result = await performersRes.json()
                setTopPerformers(result.data)
            }
            if (analyticsRes.ok) {
                const result = await analyticsRes.json()
                setIssueStats(result.data.issues)
                setSiteStats(result.data.sites)
                setDisconnectionStats(result.data.disconnections || [])
            }
        } catch (error) {
            console.error('Error fetching detailed stats:', error)
        }
    }

    if (status === 'loading' || loading) return <div className="flex items-center justify-center min-h-screen"><PageLoader /></div>

    const formatHours = (hours: number) => { if (hours < 1) return `${Math.round(hours * 60)}m`; if (hours < 24) return `${hours.toFixed(1)}h`; return `${(hours / 24).toFixed(1)}d` }
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const getTimeWaiting = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        if (days > 0) return `${days}d ${hours}h`
        return `${hours}h`
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Work Order Dashboard</h1><p className="text-gray-600 mt-1">Overview of all work orders</p></div><Link href="/admin/workorders/list" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">View All Work Orders</Link></div>
            {stats && (<>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/admin/workorders/list?status=PENDING&priority=HIGH,URGENT,CRITICAL" className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600">Urgent Attention</p><p className="text-3xl font-bold text-red-600 mt-1">{stats.urgentOpen || 0}</p></div>
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center"><HiExclamationCircle className="w-6 h-6 text-red-600" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">High priority & open</p>
                    </Link>
                    <Link href="/admin/workorders/list?status=PENDING" className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600">Unassigned</p><p className="text-3xl font-bold text-orange-600 mt-1">{stats.pending}</p></div>
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center"><HiClock className="w-6 h-6 text-orange-600" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Waiting for assignment</p>
                    </Link>
                    <Link href="/admin/workorders/list?status=IN_PROGRESS,ASSIGNED" className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600">Active Progress</p><p className="text-3xl font-bold text-blue-600 mt-1">{stats.assigned + stats.inProgress}</p></div>
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><HiWrenchScrewdriver className="w-6 h-6 text-blue-600" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Currently being worked on</p>
                    </Link>
                    <Link href="/admin/workorders/list?status=COMPLETED,VERIFIED" className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600">Completed</p><p className="text-3xl font-bold text-green-600 mt-1">{stats.completed + stats.verified}</p></div>
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><HiCheckCircle className="w-6 h-6 text-green-600" /></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Successfully closed</p>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Work Orders */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2></div>
                            <div className="divide-y divide-gray-200">
                                {recentWorkOrders.length === 0 ? <div className="p-6 text-center text-gray-500">No recent work orders</div> : recentWorkOrders.map((wo) => (
                                    <Link key={wo.id} href={`/admin/workorders/${wo.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-medium text-gray-900">{wo.workOrderNumber}</p>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[wo.status] || 'bg-gray-100'}`}>{wo.status.replace('_', ' ')}</span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[wo.priority] || 'bg-gray-100'}`}>{wo.priority}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 truncate">{wo.title}</p>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                <span>{wo.pelanggan?.nama || wo.contactName || 'Guest'}</span>
                                                {wo.assignedTo && <span>• {wo.assignedTo.fullName}</span>}
                                                {wo.status === 'PENDING' && <span className="text-orange-600 font-medium">• Waiting: {getTimeWaiting(wo.createdAt)}</span>}
                                            </div>
                                        </div>
                                        <HiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Issue Statistics */}
                        <div className="bg-white rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">Common Issues</h2>
                                <HiChartBar className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="p-6">
                                {issueStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {issueStats.map((stat, index) => (
                                            <div key={index}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-900 font-medium">{stat.issue.replace('_', ' ')}</span>
                                                    <span className="text-gray-600">{stat.count} incidents</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="bg-red-500 h-2 rounded-full"
                                                        style={{ width: `${Math.min((stat.count / issueStats[0]?.count) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center">No issue data available</p>
                                )}
                            </div>
                        </div>

                        {/* Disconnection Statistics */}
                        <div className="bg-white rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">Alasan Penarikan Perangkat</h2>
                                <HiArchiveBoxArrowDown className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="p-6">
                                {disconnectionStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {disconnectionStats.map((stat, index) => (
                                            <div key={index}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-900 font-medium">{stat.reason}</span>
                                                    <span className="text-gray-600">{stat.count} cases</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="bg-orange-500 h-2 rounded-full"
                                                        style={{ width: `${Math.min((stat.count / disconnectionStats[0]?.count) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center">No disconnection data available</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Top Performers */}
                        <div className="bg-white rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
                                <select
                                    className="text-xs border-gray-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500"
                                    value={performancePeriod}
                                    onChange={(e) => setPerformancePeriod(e.target.value)}
                                >
                                    <option value="all_time">All Time</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>

                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <HiUserGroup className="w-5 h-5 text-gray-400" />
                                    <h3 className="text-md font-medium text-gray-900">Top Performers</h3>
                                </div>
                                {topPerformers.length > 0 ? (
                                    <div className="space-y-4">
                                        {topPerformers.map((performer, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{performer.employeeName}</p>
                                                        <p className="text-xs text-gray-500">{formatHours(performer.avgCompletionTime)} avg</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-sky-600">{performer.count}</p>
                                                    <p className="text-xs text-gray-500">tasks</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center">No performance data available</p>
                                )}
                            </div>

                            {/* Site Statistics */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <HiBuildingOffice2 className="w-5 h-5 text-gray-400" />
                                    <h3 className="text-md font-medium text-gray-900">Problematic Sites</h3>
                                </div>
                                {siteStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {siteStats.map((site, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{site.siteName}</p>
                                                    <p className="text-xs text-red-500">Top issue: {site.mostCommonIssue}</p>
                                                </div>
                                                <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full">
                                                    <span className="text-xs font-bold text-red-600">{site.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center">No site data available</p>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-4">Performance Overview</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Avg Completion Time</span>
                                        <span className="font-semibold text-gray-900">{formatHours(stats.avgCompletionTimeHours)}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Customer Satisfaction</span>
                                        <span className="font-semibold text-gray-900">{stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 text-right">{stats.totalWithRating} ratings</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {departmentWorkload.length > 0 && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Department Workload</h2></div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {departmentWorkload.map((dept) => (
                                <div key={dept.departmentName} className="border rounded-lg p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-medium text-gray-900">{dept.departmentName}</h3>
                                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">{dept.total} total</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                                        <div className="bg-orange-50 rounded p-1">
                                            <p className="text-orange-600 font-bold">{dept.pending}</p>
                                            <p className="text-gray-500">Pending</p>
                                        </div>
                                        <div className="bg-blue-50 rounded p-1">
                                            <p className="text-blue-600 font-bold">{dept.inProgress}</p>
                                            <p className="text-gray-500">Active</p>
                                        </div>
                                        <div className="bg-green-50 rounded p-1">
                                            <p className="text-green-600 font-bold">{dept.completed}</p>
                                            <p className="text-gray-500">Done</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>)}
        </div>
    )
}
