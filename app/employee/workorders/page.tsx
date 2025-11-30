'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { HiMagnifyingGlass, HiMapPin, HiClock, HiCheckCircle } from 'react-icons/hi2'

export default function WorkOrdersPage() {
    const { data: session } = useSession()
    const [workOrders, setWorkOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, assigned, in_progress, completed
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadWorkOrders()
    }, [filter])

    const loadWorkOrders = async () => {
        setLoading(true)
        try {
            // TODO: Replace with actual API call
            // Simulated data for now
            setTimeout(() => {
                setWorkOrders([])
                setLoading(false)
            }, 500)
        } catch (error) {
            console.error('Error loading work orders:', error)
            setLoading(false)
        }
    }

    const employee = (session?.user as any)?.employee
    const departmentName = employee?.department?.name || 'Your Department'

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Work Orders
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Work orders assigned to {departmentName}
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Assigned</h3>
                        <HiClock className="w-5 h-5 text-yellow-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</h3>
                        <HiMapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</h3>
                        <HiCheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <HiMagnifyingGlass className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search work orders..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filter */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('assigned')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'assigned'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Assigned
                        </button>
                        <button
                            onClick={() => setFilter('in_progress')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'in_progress'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            In Progress
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'completed'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Completed
                        </button>
                    </div>
                </div>
            </div>

            {/* Work Orders List */}
            <div className="space-y-4">
                {loading ? (
                    // Loading skeletons
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 animate-pulse">
                            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                            <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    ))
                ) : workOrders.length === 0 ? (
                    // Empty state
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <div className="inline-block p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                            <HiMapPin className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No work orders found
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {filter === 'all'
                                ? `No work orders assigned to ${departmentName} yet.`
                                : `No ${filter.replace('_', ' ')} work orders at the moment.`}
                        </p>
                    </div>
                ) : (
                    // Work order list will go here
                    <div className="text-center text-gray-500">Work orders will appear here</div>
                )}
            </div>
        </div>
    )
}
