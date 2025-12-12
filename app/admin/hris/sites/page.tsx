"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiPlus,
    HiPencil,
    HiTrash,
    HiMapPin,
    HiMagnifyingGlass,
    HiUserGroup,
    HiWrench,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

interface Site {
    id: string
    code: string
    name: string
    description: string | null
    address: string | null
    isActive: boolean
    _count: {
        employees: number
        workOrders: number
    }
}

export default function SitesPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [sites, setSites] = useState<Site[]>([])
    const [search, setSearch] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }
        if (session?.user && status === 'authenticated') {
            fetchSites()
        }
    }, [session, status, router])

    const fetchSites = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append('search', search)

            const response = await fetch(`/api/admin/sites?${params}`)
            if (response.ok) {
                const result = await response.json()
                setSites(result.data || [])
            }
        } catch (error) {
            console.error('Error fetching sites:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this site?')) return

        setDeleting(id)
        try {
            const response = await fetch(`/api/admin/sites/${id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                fetchSites()
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to delete site')
            }
        } catch (error) {
            console.error('Error deleting site:', error)
            alert('An error occurred')
        } finally {
            setDeleting(null)
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <PageLoader />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sites / Area</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage work order sites and employee assignments
                    </p>
                </div>
                <Link
                    href="/admin/hris/sites/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <HiPlus className="w-5 h-5" />
                    <span>New Site</span>
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search sites..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchSites()}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* Sites Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                    Site
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                    Address
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                    Employees
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                    Work Orders
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {sites.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No sites found. Create your first site to get started.
                                    </td>
                                </tr>
                            ) : (
                                sites.map((site) => (
                                    <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                    <HiMapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {site.name}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {site.code}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                                                {site.address || '-'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                                                <HiUserGroup className="w-4 h-4" />
                                                <span>{site._count.employees}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                                                <HiWrench className="w-4 h-4" />
                                                <span>{site._count.workOrders}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${site.isActive
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                                    }`}
                                            >
                                                {site.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/hris/sites/${site.id}`}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                >
                                                    <HiPencil className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(site.id)}
                                                    disabled={deleting === site.id}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    <HiTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
