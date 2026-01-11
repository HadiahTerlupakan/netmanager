"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiClipboardDocumentList, HiClock, HiCheckCircle, HiWrenchScrewdriver, HiChevronRight, HiExclamationCircle, HiUserGroup, HiChartBar, HiBuildingOffice2, HiArchiveBoxArrowDown, HiChatBubbleLeftRight } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { useSocketEvent } from '@/hooks/useSocket'

type Statistics = { total: number; pending: number; assigned: number; inProgress: number; onHold: number; completed: number; verified: number; closed: number; cancelled: number; urgentOpen: number; avgCompletionTimeHours: number; totalCost: number; avgRating: number | null; totalWithRating: number }
type WorkOrder = { id: string; workOrderNumber: string; title: string; status: string; priority: string; type: string; contactName?: string | null; pelanggan?: { nama: string } | null; assignedTo: { name: string } | null; department: { name: string } | null; site?: { name: string } | null; createdAt: string }
type DepartmentWorkload = { departmentName: string; total: number; pending: number; inProgress: number; completed: number }
type TopPerformer = { userName: string; role?: string; site?: string; count: number; avgCompletionTime: number }
type IssueStatistic = { issue: string; count: number }
type SiteStatistic = { siteName: string; count: number; mostCommonIssue: string }

type DisconnectionStatistic = { reason: string; count: number }
type ResponseStatistic = { userName: string; totalResponses: number; avgResponseTimeMinutes: number }

const STATUS_COLORS: Record<string, string> = { PENDING: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200', ASSIGNED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200', IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200', COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200', VERIFIED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' }
const PRIORITY_COLORS: Record<string, string> = { LOW: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', NORMAL: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', URGENT: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', CRITICAL: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200' }

export function ClientComponent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Statistics | null>(null)
    const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([])
    const [departmentWorkload, setDepartmentWorkload] = useState<DepartmentWorkload[]>([])
    const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
    const [topAssists, setTopAssists] = useState<TopPerformer[]>([])
    const [issueStats, setIssueStats] = useState<IssueStatistic[]>([])
    const [siteStats, setSiteStats] = useState<SiteStatistic[]>([])
    const [disconnectionStats, setDisconnectionStats] = useState<DisconnectionStatistic[]>([])
    const [responseStats, setResponseStats] = useState<ResponseStatistic[]>([])
    const [performancePeriod, setPerformancePeriod] = useState<string>('all_time')

    useEffect(() => { if (status === 'unauthenticated') { router.push('/login'); return } if (session?.user && status === 'authenticated') fetchDashboardData() }, [session, status, router])

    useEffect(() => {
        if (session?.user && status === 'authenticated') {
            fetchDetailedStats()
        }
    }, [performancePeriod, session, status])

    // Real-time updates
    const handleUpdate = () => {
        if (session?.user && status === 'authenticated') {
            fetchDashboardData()
            fetchDetailedStats()
        }
    }

    useSocketEvent('workorder:new', handleUpdate)
    useSocketEvent('workorder:update', handleUpdate)
    useSocketEvent('workorder:assigned', handleUpdate)

    const fetchDashboardData = async () => {
        try {
            // OPTIMIZED: Single consolidated API call instead of 6 separate calls (Phase 2 optimization)
            const response = await fetch(`/api/admin/workorders/dashboard?period=${performancePeriod}`);
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data;
                
                // Set all dashboard state from single response
                setStats(data.stats);
                setRecentWorkOrders(data.recentWorkOrders);
                setDepartmentWorkload(data.departmentWorkload);
                setTopPerformers(data.topPerformers);
                setTopAssists(data.topAssists);
                setIssueStats(data.issueStats);
                setSiteStats(data.siteStats);
                setDisconnectionStats(data.disconnectionStats);
                setResponseStats(data.responseStats);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }

    const fetchDetailedStats = async () => {
        // OPTIMIZED: Reuse consolidated endpoint with period parameter
        // Only fetches period-sensitive data (performers, analytics, response stats)
        try {
            const response = await fetch(`/api/admin/workorders/dashboard?period=${performancePeriod}`);
            
            if (response.ok) {
                const result = await response.json();
                const data = result.data;
                
                // Update only period-sensitive data
                setTopPerformers(data.topPerformers);
                setTopAssists(data.topAssists);
                setIssueStats(data.issueStats);
                setSiteStats(data.siteStats);
                setDisconnectionStats(data.disconnectionStats);
                setResponseStats(data.responseStats);
            }
        } catch (error) {
            console.error('Error fetching detailed stats:', error);
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
            <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Order Dashboard</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Overview of all work orders</p></div><Link href="/admin/workorders/list" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">View All Work Orders</Link></div>
            {stats && (<>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/admin/workorders/list?status=PENDING&priority=HIGH,URGENT,CRITICAL" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Urgent Attention</p><p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.urgentOpen || 0}</p></div>
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center"><HiExclamationCircle className="w-6 h-6 text-red-600 dark:text-red-400" /></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">High priority & open</p>
                    </Link>
                    <Link href="/admin/workorders/list?status=PENDING" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unassigned</p><p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.pending}</p></div>
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center"><HiClock className="w-6 h-6 text-orange-600 dark:text-orange-400" /></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Waiting for assignment</p>
                    </Link>
                    <Link href="/admin/workorders/list?status=IN_PROGRESS,ASSIGNED" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Progress</p><p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.assigned + stats.inProgress}</p></div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"><HiWrenchScrewdriver className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Currently being worked on</p>
                    </Link>
                    <Link href="/admin/workorders/list?status=COMPLETED,VERIFIED" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p><p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.completed + stats.verified}</p></div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center"><HiCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Successfully closed</p>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Work Orders */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Work Orders</h2></div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {recentWorkOrders.length === 0 ? <div className="p-6 text-center text-gray-500 dark:text-gray-400">No recent work orders</div> : recentWorkOrders.map((wo) => (
                                    <Link key={wo.id} href={`/admin/workorders/${wo.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{wo.workOrderNumber}</p>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[wo.status] || 'bg-gray-100 dark:bg-gray-700'}`}>{wo.status.replace('_', ' ')}</span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[wo.priority] || 'bg-gray-100 dark:bg-gray-700'}`}>{wo.priority}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{wo.title}</p>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span>{wo.pelanggan?.nama || wo.contactName || 'Guest'}</span>
                                                {wo.site && <span>• <span className="font-semibold">Site:</span> {wo.site.name}</span>}
                                                {wo.assignedTo && <span>• {wo.assignedTo.name}</span>}
                                                {wo.status === 'PENDING' && <span className="text-orange-600 dark:text-orange-400 font-medium">• Waiting: {getTimeWaiting(wo.createdAt)}</span>}
                                            </div>
                                        </div>
                                        <HiChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-4" />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Issue Statistics */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Common Issues</h2>
                                <HiChartBar className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="p-6">
                                {issueStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {issueStats.map((stat, index) => (
                                            <div key={index}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-900 dark:text-white font-medium">{stat.issue.replace('_', ' ')}</span>
                                                    <span className="text-gray-600 dark:text-gray-400">{stat.count} incidents</span>
                                                </div>
                                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-red-500 h-2 rounded-full"
                                                        style={{ width: `${Math.min((stat.count / issueStats[0]?.count) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No issue data available</p>
                                )}
                            </div>
                        </div>

                        {/* Disconnection Statistics */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alasan Penarikan Perangkat</h2>
                                <HiArchiveBoxArrowDown className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="p-6">
                                {disconnectionStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {disconnectionStats.map((stat, index) => (
                                            <div key={index}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-900 dark:text-white font-medium">{stat.reason}</span>
                                                    <span className="text-gray-600 dark:text-gray-400">{stat.count} cases</span>
                                                </div>
                                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-orange-500 h-2 rounded-full"
                                                        style={{ width: `${Math.min((stat.count / disconnectionStats[0]?.count) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No disconnection data available</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Top Performers */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics</h2>
                                <select
                                    className="text-xs border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
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
                                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Top Performers</h3>
                                </div>
                                {topPerformers.length > 0 ? (
                                    <div className="space-y-4">
                                        {topPerformers.map((performer, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-400 shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{performer.userName}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">{performer.role || '-'} {performer.site ? `• ${performer.site}` : ''}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatHours(performer.avgCompletionTime)} avg</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-sky-600">{performer.count}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">tasks</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No performance data available</p>
                                )}
                            </div>

                            {/* Top Assists */}
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <HiUserGroup className="w-5 h-5 text-purple-400" />
                                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Top Assists</h3>
                                </div>
                                {topAssists.length > 0 ? (
                                    <div className="space-y-4">
                                        {topAssists.map((assist, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400 shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{assist.userName}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">{assist.role || '-'} {assist.site ? `• ${assist.site}` : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{assist.count}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">assists</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No assist data available</p>
                                )}
                            </div>

                            {/* Response Stats */}
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <HiChatBubbleLeftRight className="w-5 h-5 text-teal-400" />
                                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Response Speed</h3>
                                </div>
                                {responseStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {responseStats.map((stat, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-sm font-bold text-teal-600 dark:text-teal-400 shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{stat.userName}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">{stat.totalResponses} actions</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{stat.avgResponseTimeMinutes}m</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">avg time</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No response data available</p>
                                )}
                            </div>

                            {/* Site Statistics */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <HiBuildingOffice2 className="w-5 h-5 text-gray-400" />
                                    <h3 className="text-md font-medium text-gray-900 dark:text-white">Problematic Sites</h3>
                                </div>
                                {siteStats.length > 0 ? (
                                    <div className="space-y-4">
                                        {siteStats.map((site, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{site.siteName}</p>
                                                    <p className="text-xs text-red-500">Top issue: {site.mostCommonIssue}</p>
                                                </div>
                                                <div className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full">
                                                    <span className="text-xs font-bold text-red-600 dark:text-red-400">{site.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No site data available</p>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">Performance Overview</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Avg Completion Time</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{formatHours(stats.avgCompletionTimeHours)}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Customer Satisfaction</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-right">{stats.totalWithRating} ratings</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {departmentWorkload.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Department Workload</h2></div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {departmentWorkload.map((dept) => (
                                <div key={dept.departmentName} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-medium text-gray-900 dark:text-white">{dept.departmentName}</h3>
                                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">{dept.total} total</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-1">
                                            <p className="text-orange-600 dark:text-orange-400 font-bold">{dept.pending}</p>
                                            <p className="text-gray-500 dark:text-gray-400">Pending</p>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-1">
                                            <p className="text-blue-600 dark:text-blue-400 font-bold">{dept.inProgress}</p>
                                            <p className="text-gray-500 dark:text-gray-400">Active</p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded p-1">
                                            <p className="text-green-600 dark:text-green-400 font-bold">{dept.completed}</p>
                                            <p className="text-gray-500 dark:text-gray-400">Done</p>
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
