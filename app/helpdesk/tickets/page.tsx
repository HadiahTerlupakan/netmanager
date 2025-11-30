'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { HiMagnifyingGlass, HiFunnel } from 'react-icons/hi2'

export default function TicketsPage() {
    const { data: session } = useSession()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, open, in_progress, resolved
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadTickets()
    }, [filter])

    const loadTickets = async () => {
        setLoading(true)
        try {
            // TODO: Replace with actual API call
            // Simulated data for now
            setTimeout(() => {
                setTickets([])
                setLoading(false)
            }, 500)
        } catch (error) {
            console.error('Error loading tickets:', error)
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    My Tickets
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage and respond to customer support tickets
                </p>
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
                            placeholder="Search tickets..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filter */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('open')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'open'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Open
                        </button>
                        <button
                            onClick={() => setFilter('in_progress')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'in_progress'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            In Progress
                        </button>
                    </div>
                </div>
            </div>

            {/* Tickets List */}
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
                ) : tickets.length === 0 ? (
                    // Empty state
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <div className="inline-block p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                            <HiFunnel className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No tickets found
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {filter === 'all'
                                ? "You don't have any assigned tickets yet."
                                : `No ${filter.replace('_', ' ')} tickets at the moment.`}
                        </p>
                    </div>
                ) : (
                    // Ticket list will go here
                    <div className="text-center text-gray-500">Tickets will appear here</div>
                )}
            </div>
        </div>
    )
}
