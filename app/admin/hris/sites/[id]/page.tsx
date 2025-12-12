"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { HiArrowLeft, HiMapPin } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

interface Site {
    id: string
    code: string
    name: string
    description: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    isActive: boolean
    employees: Array<{
        id: string
        employeeId: string
        fullName: string
        department: { name: string } | null
    }>
}

export default function EditSitePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [site, setSite] = useState<Site | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        address: '',
        latitude: '',
        longitude: '',
        isActive: true,
    })

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login')
        if (id && status === 'authenticated') fetchSite()
    }, [id, status, router])

    const fetchSite = async () => {
        try {
            const response = await fetch(`/api/admin/sites/${id}`)
            if (response.ok) {
                const result = await response.json()
                setSite(result.data)
                setFormData({
                    code: result.data.code,
                    name: result.data.name,
                    description: result.data.description || '',
                    address: result.data.address || '',
                    latitude: result.data.latitude?.toString() || '',
                    longitude: result.data.longitude?.toString() || '',
                    isActive: result.data.isActive,
                })
            } else if (response.status === 404) {
                router.push('/admin/hris/sites')
            }
        } catch (error) {
            console.error('Error fetching site:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.code || !formData.name) {
            alert('Code and name are required')
            return
        }

        setSaving(true)

        try {
            const response = await fetch(`/api/admin/sites/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                router.push('/admin/hris/sites')
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to update site')
            }
        } catch (error) {
            console.error('Error updating site:', error)
            alert('An error occurred')
        } finally {
            setSaving(false)
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <PageLoader />
            </div>
        )
    }

    if (!site) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Site not found</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/hris/sites"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <HiArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Site</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Update site information
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <HiMapPin className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">{site.name}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{site.code}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Site Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Site Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Address
                    </label>
                    <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Latitude
                        </label>
                        <input
                            type="number"
                            step="any"
                            value={formData.latitude}
                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Longitude
                        </label>
                        <input
                            type="number"
                            step="any"
                            value={formData.longitude}
                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Site is active</span>
                    </label>
                </div>

                {/* Assigned Employees */}
                {site.employees.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Assigned Employees ({site.employees.length})
                        </h3>
                        <div className="space-y-2">
                            {site.employees.map((emp) => (
                                <div key={emp.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.fullName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {emp.employeeId} • {emp.department?.name || 'No Department'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                        href="/admin/hris/sites"
                        className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-center font-medium transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    )
}
