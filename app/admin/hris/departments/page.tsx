'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineShieldCheck } from 'react-icons/hi2'

interface Department {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    allowedFeatures: string | null
    createdAt: string
}

const AVAILABLE_FEATURES = [
    { value: 'FINANCE', label: 'Finance & Billing' },
    { value: 'HRIS', label: 'HR & Payroll' },
    { value: 'PELANGGAN', label: 'Customer Management' },
    { value: 'FTTH', label: 'FTTH Infrastructure' },
    { value: 'NETWORK', label: 'Network Management' },
    { value: 'REPORTS', label: 'Reports & Analytics' },
]

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingDept, setEditingDept] = useState<Department | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        jobDescription: '',
        allowedFeatures: [] as string[],
    })

    useEffect(() => {
        fetchDepartments()
    }, [])

    const fetchDepartments = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/hris/departments')
            const data = await res.json()
            if (res.ok) {
                setDepartments(data.departments || [])
            }
        } catch (error) {
            console.error('Error fetching departments:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const payload = {
                ...formData,
                allowedFeatures: JSON.stringify(formData.allowedFeatures),
            }

            const url = editingDept
                ? `/api/hris/departments/${editingDept.id}`
                : '/api/hris/departments'

            const res = await fetch(url, {
                method: editingDept ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                alert(editingDept ? 'Department updated!' : 'Department created!')
                setShowModal(false)
                setFormData({ name: '', description: '', jobDescription: '', allowedFeatures: [] })
                setEditingDept(null)
                fetchDepartments()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error || 'Failed to save department'}`)
            }
        } catch (error) {
            console.error('Error saving department:', error)
            alert('Failed to save department')
        }
    }

    const handleEdit = (dept: Department) => {
        setEditingDept(dept)
        let features: string[] = []
        try {
            features = dept.allowedFeatures ? JSON.parse(dept.allowedFeatures) : []
        } catch (e) {
            features = []
        }

        setFormData({
            name: dept.name,
            description: dept.description || '',
            jobDescription: dept.jobDescription || '',
            allowedFeatures: features,
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return

        try {
            const res = await fetch(`/api/hris/departments/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                alert('Department deleted!')
                fetchDepartments()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error || 'Failed to delete department'}`)
            }
        } catch (error) {
            console.error('Error deleting department:', error)
            alert('Failed to delete department')
        }
    }

    const openCreateModal = () => {
        setEditingDept(null)
        setFormData({ name: '', description: '', jobDescription: '', allowedFeatures: [] })
        setShowModal(true)
    }

    const toggleFeature = (feature: string) => {
        setFormData(prev => ({
            ...prev,
            allowedFeatures: prev.allowedFeatures.includes(feature)
                ? prev.allowedFeatures.filter(f => f !== feature)
                : [...prev.allowedFeatures, feature]
        }))
    }

    const parseFeatures = (featuresJson: string | null): string[] => {
        try {
            return featuresJson ? JSON.parse(featuresJson) : []
        } catch (e) {
            return []
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Departments</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Kelola department dengan job description dan feature access
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <HiOutlinePlus className="w-4 h-4" />
                    Tambah Department
                </button>
            </div>

            {/* Departments Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                        Job Description
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                        Allowed Features
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                {departments.map((dept) => {
                                    const features = parseFeatures(dept.allowedFeatures)
                                    return (
                                        <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {dept.name}
                                                </div>
                                                {dept.description && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {dept.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                                    {dept.jobDescription || '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {features.length > 0 ? (
                                                        features.map((feature) => (
                                                            <span
                                                                key={feature}
                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs rounded-full"
                                                            >
                                                                <HiOutlineShieldCheck className="w-3 h-3" />
                                                                {AVAILABLE_FEATURES.find(f => f.value === feature)?.label || feature}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm text-gray-400">No features</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(dept.createdAt).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-3">
                                                <button
                                                    onClick={() => handleEdit(dept)}
                                                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                                                >
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(dept.id, dept.name)}
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center gap-1"
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

                        {departments.length === 0 && !loading && (
                            <div className="p-8 text-center text-gray-500">
                                No departments found. Create one to get started!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            {editingDept ? 'Edit Department' : 'Create Department'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Department Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g., IT, Finance, Operations"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Short Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Brief description"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Job Description & Responsibilities
                                </label>
                                <textarea
                                    value={formData.jobDescription}
                                    onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Detailed job description, responsibilities, and main tasks for this department..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Allowed Features/Modules
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Select which system features members of this department can access
                                </p>
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
                                        setEditingDept(null)
                                        setFormData({ name: '', description: '', jobDescription: '', allowedFeatures: [] })
                                    }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                >
                                    {editingDept ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
