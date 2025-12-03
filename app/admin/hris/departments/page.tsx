'use client'

import { useState, useEffect } from 'react'
import {
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineShieldCheck,
    HiOutlineBuildingOffice,
    HiOutlineCheckCircle,
} from 'react-icons/hi2'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface Department {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    allowedFeatures: string | null
    createdAt: string
    _count?: {
        employees: number
    }
}

const AVAILABLE_FEATURES = [
    { value: 'FINANCE', label: 'Finance & Billing', icon: '💰', color: 'emerald' },
    { value: 'HRIS', label: 'HR & Payroll', icon: '👥', color: 'blue' },
    { value: 'PELANGGAN', label: 'Customer Management', icon: '👤', color: 'purple' },
    { value: 'FTTH', label: 'FTTH Infrastructure', icon: '🌐', color: 'cyan' },
    { value: 'NETWORK', label: 'Network Management', icon: '🔌', color: 'indigo' },
    { value: 'REPORTS', label: 'Reports & Analytics', icon: '📊', color: 'pink' },
    { value: 'HELPDESK', label: 'Helpdesk & Support', icon: '🎫', color: 'orange' },
    { value: 'WORKORDERS', label: 'Work Orders', icon: '🔧', color: 'amber' },
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

        if (!formData.name.trim()) {
            alert('Department name is required')
            return
        }

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
                alert(editingDept ? 'Department updated successfully!' : 'Department created successfully!')
                closeModal()
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
                alert('Department deleted successfully!')
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

    const toggleFeature = (feature: string) => {
        setFormData(prev => ({
            ...prev,
            allowedFeatures: prev.allowedFeatures.includes(feature)
                ? prev.allowedFeatures.filter(f => f !== feature)
                : [...prev.allowedFeatures, feature]
        }))
    }

    const openModal = () => {
        setEditingDept(null)
        setFormData({ name: '', description: '', jobDescription: '', allowedFeatures: [] })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingDept(null)
        setFormData({ name: '', description: '', jobDescription: '', allowedFeatures: [] })
    }

    const parseFeatures = (featuresJson: string | null): string[] => {
        try {
            return featuresJson ? JSON.parse(featuresJson) : []
        } catch (e) {
            return []
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineBuildingOffice className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        Departments
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage company departments and their feature access
                    </p>
                </div>
                <button
                    onClick={openModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Add Department
                </button>
            </div>

            {/* Departments Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            ) : departments.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <HiOutlineBuildingOffice className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Departments Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Get started by creating your first department
                    </p>
                    <button
                        onClick={openModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <HiOutlinePlus className="w-5 h-5" />
                        Create Department
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {departments.map((dept) => {
                        const features = parseFeatures(dept.allowedFeatures)
                        return (
                            <div
                                key={dept.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all overflow-hidden group"
                            >
                                {/* Card Header */}
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                                {dept.name}
                                            </h3>
                                            {dept.description && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                    {dept.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Employee Count */}
                                    {dept._count && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            <HiOutlineShieldCheck className="w-4 h-4" />
                                            <span>{dept._count.employees} employees</span>
                                        </div>
                                    )}
                                </div>

                                {/* Features */}
                                <div className="p-6">
                                    <div className="mb-3">
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                            Allowed Features
                                        </h4>
                                        {features.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {features.map(feature => {
                                                    const featureConfig = AVAILABLE_FEATURES.find(f => f.value === feature)
                                                    return (
                                                        <span
                                                            key={feature}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                                        >
                                                            {featureConfig?.icon && <span>{featureConfig.icon}</span>}
                                                            {featureConfig?.label || feature}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                                No features assigned
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="px-6 pb-6 flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(dept)}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <HiOutlinePencil className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(dept.id, dept.name)}
                                        className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingDept ? 'Edit Department' : 'Create New Department'}
                description={editingDept ? 'Update department information and features' : 'Add a new department to your organization'}
                size="2xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Department Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Department Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="e.g., IT Department, Human Resources"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Brief description of this department..."
                        />
                    </div>

                    {/* Job Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Job Description
                        </label>
                        <textarea
                            value={formData.jobDescription}
                            onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                            rows={4}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Detailed job description and responsibilities..."
                        />
                    </div>

                    {/* Allowed Features */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Allowed Features
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {AVAILABLE_FEATURES.map((feature) => {
                                const isSelected = formData.allowedFeatures.includes(feature.value)
                                return (
                                    <button
                                        key={feature.value}
                                        type="button"
                                        onClick={() => toggleFeature(feature.value)}
                                        className={`relative flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${isSelected
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex-shrink-0 text-2xl">
                                            {feature.icon}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {feature.label}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <HiOutlineCheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Select features that employees in this department can access
                        </p>
                    </div>

                    {/* Actions */}
                    <ModalFooter>
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
                        >
                            {editingDept ? 'Update Department' : 'Create Department'}
                        </button>
                    </ModalFooter>
                </form>
            </Modal>
        </div>
    )
}
