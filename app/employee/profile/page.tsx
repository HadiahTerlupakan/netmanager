'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HiOutlineUser, HiOutlinePencil } from 'react-icons/hi2'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/LoadingSkeleton'

interface Employee {
    id: string
    employeeId: string
    fullName: string
    email: string | null
    phone: string | null
    dateOfBirth: string | null
    address: string | null
    position?: { title: string }
    department?: { name: string }
    employmentStatus: string
    joinDate: string
    emergencyName: string | null
    emergencyPhone: string | null
    emergencyRelation: string | null
}

export default function EmployeeProfile() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { showToast } = useToast()
    const [profile, setProfile] = useState<Employee | null>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<Partial<Employee>>({})

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/employee/login')
        } else if (status === 'authenticated') {
            loadProfile()
        }
    }, [status, router])

    const loadProfile = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/hris/employees/me')
            if (res.ok) {
                const data = await res.json()
                console.log('[PROFILE PAGE] Received data:', data)
                setProfile(data)
                setFormData(data)
            } else {
                showToast('error', 'Failed to load profile')
            }
        } catch (error) {
            console.error('Error loading profile:', error)
            showToast('error', 'Failed to load profile')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/hris/employees/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: formData.phone,
                    address: formData.address,
                    emergencyName: formData.emergencyName,
                    emergencyPhone: formData.emergencyPhone,
                    emergencyRelation: formData.emergencyRelation,
                }),
            })

            if (res.ok) {
                showToast('success', 'Profile updated successfully!')
                setEditing(false)
                loadProfile()
            } else {
                const data = await res.json()
                showToast('error', data.error || 'Failed to update profile')
            }
        } catch (error) {
            console.error('Error updating profile:', error)
            showToast('error', 'Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        setFormData(profile || {})
        setEditing(false)
    }

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8">
                    <div className="flex items-center gap-6">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="flex-1">
                            <Skeleton className="h-8 w-48 mb-2" />
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-6 w-40" />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                    </div>
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500 mb-4">Failed to load profile</p>
                <button
                    onClick={loadProfile}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Retry
                </button>
                <p className="text-xs text-gray-400 mt-4">
                    Status: {status} | Loading: {loading.toString()}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    View and manage your personal information
                </p>
            </div>

            {/* Profile Header Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                        <HiOutlineUser className="w-12 h-12" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold">{profile.fullName}</h2>
                        <p className="text-indigo-100 mt-1">{profile.employeeId}</p>
                        <div className="flex gap-4 mt-2">
                            <span className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur">
                                {profile.position?.title || 'No Position'}
                            </span>
                            <span className="px-3 py-1 bg-white/20 rounded-full text-sm backdrop-blur">
                                {profile.department?.name || 'No Department'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Personal Information
                    </h3>
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        >
                            <HiOutlinePencil className="w-4 h-4" />
                            Edit
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Full Name
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {profile.fullName}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Email
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {profile.email || '-'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Phone
                        </label>
                        {editing ? (
                            <input
                                type="tel"
                                value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        ) : (
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                                {profile.phone || '-'}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Date of Birth
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('id-ID') : '-'}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Address
                        </label>
                        {editing ? (
                            <textarea
                                value={formData.address || ''}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        ) : (
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                                {profile.address || '-'}
                            </div>
                        )}
                    </div>
                </div>

                {editing && (
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            {/* Employment Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Employment Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Employee ID
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {profile.employeeId}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Department
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {profile.department?.name || '-'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Position
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {profile.position?.title || '-'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Employment Status
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className={`px-2 py-1 text-xs rounded-full ${profile.employmentStatus === 'PERMANENT'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                {profile.employmentStatus}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Join Date
                        </label>
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                            {new Date(profile.joinDate).toLocaleDateString('id-ID')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Emergency Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Name
                        </label>
                        {editing ? (
                            <input
                                type="text"
                                value={formData.emergencyName || ''}
                                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        ) : (
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                                {profile.emergencyName || '-'}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Phone
                        </label>
                        {editing ? (
                            <input
                                type="tel"
                                value={formData.emergencyPhone || ''}
                                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        ) : (
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                                {profile.emergencyPhone || '-'}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Relation
                        </label>
                        {editing ? (
                            <input
                                type="text"
                                value={formData.emergencyRelation || ''}
                                onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        ) : (
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                                {profile.emergencyRelation || '-'}
                            </div>
                        )}
                    </div>
                </div>

                {editing && (
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
