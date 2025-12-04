"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiClipboardDocumentList, HiClock, HiCheckCircle, HiWrenchScrewdriver, HiChevronRight } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

type Statistics = { total: number; pending: number; assigned: number; inProgress: number; onHold: number; completed: number; verified: number; closed: number; cancelled: number; avgCompletionTimeHours: number; totalCost: number; avgRating: number | null; totalWithRating: number }
type WorkOrder = { id: string; workOrderNumber: string; title: string; status: string; priority: string; type: string; pelanggan: { nama: string }; assignedTo: { fullName: string } | null; department: { name: string } | null; createdAt: string }
type DepartmentWorkload = { departmentName: string; total: number; pending: number; inProgress: number; completed: number }

const STATUS_COLORS: Record<string, string> = { PENDING: 'bg-orange-100 text-orange-800', ASSIGNED: 'bg-yellow-100 text-yellow-800', IN_PROGRESS: 'bg-blue-100 text-blue-800', COMPLETED: 'bg-green-100 text-green-800', VERIFIED: 'bg-green-100 text-green-800' }
const PRIORITY_COLORS: Record<string, string> = { LOW: 'bg-gray-100 text-gray-600', NORMAL: 'bg-blue-100 text-blue-600', HIGH: 'bg-orange-100 text-orange-600', URGENT: 'bg-red-100 text-red-600', CRITICAL: 'bg-red-200 text-red-800' }

export default function WorkOrderDashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Statistics | null>(null)
    const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([])
    const [departmentWorkload, setDepartmentWorkload] = useState<DepartmentWorkload[]>([])

    useEffect(() => { if (status === 'unauthenticated') { router.push('/login'); return } if (session?.user && status === 'authenticated') fetchDashboardData() }, [session, status, router])

    const fetchDashboardData = async () => {
        try {
            const [statsRes, recentRes, workloadRes] = await Promise.all([fetch('/api/admin/workorders/stats'), fetch('/api/admin/workorders/recent'), fetch('/api/admin/workorders/department-workload')])
            if (statsRes.ok) { const result = await statsRes.json(); setStats(result.data) }
            if (recentRes.ok) { const result = await recentRes.json(); setRecentWorkOrders(result.data) }
            if (workloadRes.ok) { const result = await workloadRes.json(); setDepartmentWorkload(result.data) }
        } catch (error) { console.error('Error fetching dashboard data:', error) }
        finally { setLoading(false) }
    }

    if (status === 'loading' || loading) return <div className="flex items-center justify-center min-h-screen"><PageLoader /></div>

    const formatHours = (hours: number) => { if (hours < 1) return `${Math.round(hours * 60)} minutes`; if (hours < 24) return `${hours.toFixed(1)} hours`; return `${(hours / 24).toFixed(1)} days` }
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Work Order Dashboard</h1><p className="text-gray-600 mt-1">Overview of all work orders</p></div><Link href="/admin/workorders/list" className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">View All Work Orders</Link></div>
            {stats && (<>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Work Orders</p><p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p></div><div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><HiClipboardDocumentList className="w-6 h-6 text-blue-600" /></div></div></div>
                    <div className="bg-white rounded-lg shadow p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Pending</p><p className="text-3xl font-bold text-orange-600 mt-1">{stats.pending}</p></div><div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center"><HiClock className="w-6 h-6 text-orange-600" /></div></div></div>
                    <div className="bg-white rounded-lg shadow p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">In Progress</p><p className="text-3xl font-bold text-yellow-600 mt-1">{stats.assigned + stats.inProgress}</p></div><div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center"><HiWrenchScrewdriver className="w-6 h-6 text-yellow-600" /></div></div></div>
                    <div className="bg-white rounded-lg shadow p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Completed</p><p className="text-3xl font-bold text-green-600 mt-1">{stats.completed + stats.verified}</p></div><div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><HiCheckCircle className="w-6 h-6 text-green-600" /></div></div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg shadow p-6"><h3 className="text-sm font-medium text-gray-600 mb-2">Avg Completion Time</h3><p className="text-2xl font-bold text-gray-900">{formatHours(stats.avgCompletionTimeHours)}</p></div>
                    <div className="bg-white rounded-lg shadow p-6"><h3 className="text-sm font-medium text-gray-600 mb-2">Total Cost</h3><p className="text-2xl font-bold text-gray-900">Rp {stats.totalCost.toLocaleString('id-ID')}</p></div>
                    <div className="bg-white rounded-lg shadow p-6"><h3 className="text-sm font-medium text-gray-600 mb-2">Customer Satisfaction</h3><p className="text-2xl font-bold text-gray-900">{stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'}</p><p className="text-xs text-gray-500 mt-1">{stats.totalWithRating} ratings</p></div>
                </div>
                <div className="bg-white rounded-lg shadow"><div className="p-6 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2></div><div className="divide-y divide-gray-200">{recentWorkOrders.length === 0 ? <div className="p-6 text-center text-gray-500">No recent work orders</div> : recentWorkOrders.map((wo) => (<Link key={wo.id} href={`/admin/workorders/${wo.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><p className="text-sm font-medium text-gray-900">{wo.workOrderNumber}</p><span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[wo.status] || 'bg-gray-100'}`}>{wo.status.replace('_', ' ')}</span><span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[wo.priority] || 'bg-gray-100'}`}>{wo.priority}</span></div><p className="text-sm text-gray-600 truncate">{wo.title}</p><div className="flex items-center gap-4 mt-1 text-xs text-gray-500"><span>{wo.pelanggan.nama}</span>{wo.assignedTo && <span>• {wo.assignedTo.fullName}</span>}<span>• {formatDate(wo.createdAt)}</span></div></div><HiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" /></Link>))}</div></div>
                {departmentWorkload.length > 0 && (<div className="bg-white rounded-lg shadow"><div className="p-6 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Department Workload</h2></div><div className="p-6 space-y-4">{departmentWorkload.map((dept) => (<div key={dept.departmentName}><div className="flex items-center justify-between mb-2"><h3 className="font-medium text-gray-900">{dept.departmentName}</h3><span className="text-sm text-gray-500">{dept.total} total</span></div><div className="grid grid-cols-3 gap-2 text-sm"><div className="bg-orange-50 rounded p-2"><p className="text-orange-600 font-medium">{dept.pending}</p><p className="text-gray-600 text-xs">Pending</p></div><div className="bg-blue-50 rounded p-2"><p className="text-blue-600 font-medium">{dept.inProgress}</p><p className="text-gray-600 text-xs">In Progress</p></div><div className="bg-green-50 rounded p-2"><p className="text-green-600 font-medium">{dept.completed}</p><p className="text-gray-600 text-xs">Completed</p></div></div></div>))}</div></div>)}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/admin/workorders/list?status=PENDING" className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-lg p-6 hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"><h3 className="text-lg font-semibold mb-2">Pending Work Orders</h3><p className="text-white/90 text-sm mb-4">Handle unassigned work orders</p><div className="flex items-center gap-2 text-sm font-medium"><span>View Pending</span><span>→</span></div></Link>
                    <Link href="/admin/workorders/list?status=IN_PROGRESS" className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-lg p-6 hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg"><h3 className="text-lg font-semibold mb-2">Active Work</h3><p className="text-white/90 text-sm mb-4">Track ongoing field work</p><div className="flex items-center gap-2 text-sm font-medium"><span>View Active</span><span>→</span></div></Link>
                    <Link href="/admin/workorders/list?unassignedOnly=true" className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg p-6 hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"><h3 className="text-lg font-semibold mb-2">Unassigned</h3><p className="text-white/90 text-sm mb-4">Assign to available technicians</p><div className="flex items-center gap-2 text-sm font-medium"><span>Manage Assignment</span><span>→</span></div></Link>
                </div>
            </>)}
        </div>
    )
}
