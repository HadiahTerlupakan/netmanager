'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineShieldCheck,
    HiOutlineUsers,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
} from 'react-icons/hi2'

interface CustomRole {
    id: string
    name: string
    code: string
    description: string | null
    departmentId: string
    department: {
        name: string
    }
    allowedFeatures: string | null
    priority: number
    isActive: boolean
    createdAt: string
    _count: {
        employeeRoles: number
    }
}

interface Department {
    id: string
    name: string
}

const AVAILABLE_FEATURES = [
    { value: 'FINANCE', label: 'Finance & Billing' },
    { value: 'HRIS', label: 'HR & Payroll' },
    { value: 'PELANGGAN', label: 'Customer Management' },
    { value: 'FTTH', label: 'FTTH Infrastructure' },
    { value: 'NETWORK', label: 'Network Management' },
    { value: 'REPORTS', label: 'Reports & Analytics' },
    { value: 'HELPDESK', label: 'Helpdesk & Support' },
    { value: 'WORKORDERS', label: 'Work Orders' },
]

export default function RoleManagementPage() {
    const router = useRouter()
    const [roles, setRoles] = useState<CustomRole[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
    const [selectedDept, setSelectedDept] = useState<string>('')
    const [searchQuery, setSearchQuery] = useState('')

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        departmentId: '',
        allowedFeatures: [] as string[],
        priority: 50,
    })

    useEffect(() => {
        fetchDepartments()
        fetchRoles()
    }, [selectedDept])

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/hris/departments')
            const data = await res.json()
            if (res.ok) {
                setDepartments(data.departments || [])
            }
        } catch (error) {
            console.error('Error fetching departments:', error)
        }
    }

    const fetchRoles = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (selectedDept) params.append('departmentId', selectedDept)
            if (searchQuery) params.append('search', searchQuery)

            const res = await fetch(`/api/admin/roles?${params}`)
            const data = await res.json()

            if (res.ok) {
                setRoles(data.roles || [])
            }
        } catch (error) {
            console.error('Error fetching roles:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || !formData.departmentId) {
            alert('Please fill in all required fields')
            return
        }

        try {
            const url = editingRole
                ? `/api/admin/roles/${editingRole.id}`
                : '/api/admin/roles'

            const res = await fetch(url, {
                method: editingRole ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    code: formData.code || undefined, // Auto-generate if empty
                }),
            })

            if (res.ok) {
                alert(editingRole ? 'Role updated successfully!' : 'Role created successfully!')
                setShowModal(false)
                resetForm()
                fetchRoles()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error || 'Failed to save role'}`)
            }
        } catch (error) {
            console.error('Error saving role:', error)
            alert('Failed to save role')
        }
    }

    const handleEdit = (role: CustomRole) => {
        setEditingRole(role)

        let features: string[] = []
        try {
            features = role.allowedFeatures ? JSON.parse(role.allowedFeatures) : []
        } catch (e) {
            features = []
        }

        setFormData({
            name: role.name,
            code: role.code,
            description: role.description || '',
            departmentId: role.departmentId,
            allowedFeatures: features,
            priority: role.priority,
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string, name: string, assignmentCount: number) => {
        if (assignmentCount > 0) {
            alert(`Cannot delete role "${name}": ${assignmentCount} employee(s) have this role assigned. Please remove all assignments first.`)
            return
        }

        if (!confirm(`Are you sure you want to delete role "${name}"?`)) return

        try {
            const res = await fetch(`/api/admin/roles/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                alert('Role deleted successfully!')
                fetchRoles()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error || 'Failed to delete role'}`)
            }
        } catch (error) {
            console.error('Error deleting role:', error)
            alert('Failed to delete role')
        }
    }

    const toggleFeature = (feature: string) => {
        setFormData(prev => ({
            ...prev,
            allowedFeatures: prev.allowedFeatures.includes(feature)
                ? prev.allowedFeatures.filter(f => f !== feature)
                : [...prev.allowedFeatures, feature]
        }))
    }

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            description: '',
            departmentId: '',
            allowedFeatures: [],
            priority: 50,
        })
        setEditingRole(null)
    }

    const openCreateModal = () => {
        resetForm()
        setShowModal(true)
    }

    const parseFeatures = (featuresJson: string | null): string[] => {
        try {
            return featuresJson ? JSON.parse(featuresJson) : []
        } catch (e) {
            return []
        }
    }

    const getPriorityLabel = (priority: number): string => {
        if (priority >= 76) return 'High'
        if (priority >= 26) return 'Medium'
        return 'Low'
    }

    const getPriorityColor = (priority: number): string => {
        if (priority >= 76) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        if (priority >= 26) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Custom Roles
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Create and manage custom roles with specific permissions
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <HiOutlinePlus className="w-4 h-4" />
                    Create Role
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                </select>

                <input
                    type="text"
                    placeholder="Search roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchRoles()}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
            </div>

            {/* Roles Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Role
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Department
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Priority
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Features
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Assignments
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {roles.map((role) => {
                                    const features = parseFeatures(role.allowedFeatures)
                                    return (
                                        <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {role.name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                    {role.code}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                {role.department.name}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(role.priority)}`}>
                                                    {role.priority} - {getPriorityLabel(role.priority)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {features.slice(0, 3).map(feature => (
                                                        <span
                                                            key={feature}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs rounded-full"
                                                        >
                                                            {AVAILABLE_FEATURES.find(f => f.value === feature)?.label || feature}
                                                        </span>
                                                    ))}
                                                    {features.length > 3 && (
                                                        <span className="text-xs text-gray-500">
                                                            +{features.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                                    <HiOutlineUsers className="w-4 h-4" />
                                                    {role._count.employeeRoles}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {role.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                                        <HiOutlineCheckCircle className="w-4 h-4" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                        <HiOutlineXCircle className="w-4 h-4" />
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-3">
                                                <button
                                                    onClick={() => handleEdit(role)}
                                                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 inline-flex items-center gap-1"
                                                >
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(role.id, role.name, role._count.employeeRoles)}
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 inline-flex items-center gap-1"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {roles.length === 0 && !loading && (
                            <div className="p-8 text-center text-gray-500">
                                No roles found. Create one to get started!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            {editingRole ? 'Edit Role' : 'Create New Role'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Role Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="e.g., Field Technician"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Role Code (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                                        placeholder="AUTO-GENERATED"
                                        disabled={!!editingRole}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Department <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    disabled={!!editingRole}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Describe this role..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Priority (1-100)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={formData.priority}
                                        onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                        className="flex-1"
                                    />
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(formData.priority)}`}>
                                        {formData.priority} - {getPriorityLabel(formData.priority)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Higher priority wins in permission conflicts
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Allowed Features
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {AVAILABLE_FEATURES.map((feature) => (
                                        <label
                                            key={feature.value}
                                            className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.allowedFeatures.includes(feature.value)}
                                                onChange={() => toggleFeature(feature.value)}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                {feature.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        resetForm()
                                    }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    {editingRole ? 'Update Role' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
