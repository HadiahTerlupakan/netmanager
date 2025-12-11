'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import RoleCard from './RoleCard'
import {
    HiOutlineBuildingOffice,
    HiOutlineShieldCheck,
    HiOutlinePlus,
    HiXMark
} from 'react-icons/hi2'
import {
    FiBarChart,
    FiShield,
    FiGlobe,
    FiWifi,
    FiShoppingCart,
    FiUsers,
    FiBox,
    FiUser,
    FiHelpCircle,
    FiTool,
    FiUser as FiUserGroup,
    FiDollarSign,
    FiSettings
} from 'react-icons/fi'

interface Department {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
    allowedFeatures: string | null
}

interface Role {
    id: string
    name: string
    code: string
    description: string | null
    allowedFeatures: string | null
    isActive: boolean
    _count: {
        employeeRoles: number
    }
}

interface DepartmentModalProps {
    isOpen: boolean
    onClose: () => void
    department: Department | null
    onSave: (data: any) => Promise<void>
    onCreateRole: (data: any) => Promise<void>
    onUpdateRole: (roleId: string, data: any) => Promise<void>
    onDeleteRole: (roleId: string, roleName: string, assignmentCount: number) => Promise<void>
}

const AVAILABLE_FEATURES = [
    { value: 'DASHBOARD', label: 'Dashboard', icon: <FiBarChart className="w-5 h-5" />, color: 'blue' },
    { value: 'ROLES', label: 'Roles', icon: <FiShield className="w-5 h-5" />, color: 'purple' },
    { value: 'NETWORK', label: 'Network', icon: <FiGlobe className="w-5 h-5" />, color: 'indigo' },
    { value: 'FTTH', label: 'FTTH', icon: <FiWifi className="w-5 h-5" />, color: 'cyan' },
    { value: 'PAKET', label: 'Package Management', icon: <FiShoppingCart className="w-5 h-5" />, color: 'emerald' },
    { value: 'PELANGGAN', label: 'Customer Management', icon: <FiUsers className="w-5 h-5" />, color: 'purple' },
    { value: 'INVENTORY', label: 'Inventory', icon: <FiBox className="w-5 h-5" />, color: 'blue' },
    { value: 'USERS', label: 'User Management', icon: <FiUser className="w-5 h-5" />, color: 'green' },
    { value: 'HELPDESK', label: 'Helpdesk & Support', icon: <FiHelpCircle className="w-5 h-5" />, color: 'orange' },
    { value: 'WORKORDERS', label: 'Work Orders', icon: <FiTool className="w-5 h-5" />, color: 'amber' },
    { value: 'HRIS', label: 'HR & Payroll', icon: <FiUserGroup className="w-5 h-5" />, color: 'blue' },
    { value: 'FINANCE', label: 'Finance & Billing', icon: <FiDollarSign className="w-5 h-5" />, color: 'emerald' },
    { value: 'PENGATURAN', label: 'Pengaturan', icon: <FiSettings className="w-5 h-5" />, color: 'gray' }
]

export default function DepartmentModal({
    isOpen,
    onClose,
    department,
    onSave,
    onCreateRole,
    onUpdateRole,
    onDeleteRole
}: DepartmentModalProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'permissions' | 'roles'>('info')
    const [loading, setLoading] = useState(false)
    const [roles, setRoles] = useState<Role[]>([])
    const [showRoleModal, setShowRoleModal] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        jobDescription: '',
        allowedFeatures: [] as string[],
    })

    const [roleFormData, setRoleFormData] = useState({
        name: '',
        code: '',
        description: '',
        allowedFeatures: [] as string[],
        isActive: true,
    })

    useEffect(() => {
        if (department) {
            setFormData({
                name: department.name,
                description: department.description || '',
                jobDescription: department.jobDescription || '',
                allowedFeatures: department.allowedFeatures ? JSON.parse(department.allowedFeatures) : [],
            })
            // Load roles for this department
            fetchRoles()
        } else {
            setFormData({
                name: '',
                description: '',
                jobDescription: '',
                allowedFeatures: [],
            })
            setRoles([])
        }
        setActiveTab('info')
    }, [department, isOpen])

    const fetchRoles = async () => {
        if (!department) return

        try {
            const res = await fetch(`/api/hris/departments/${department.id}/roles`)
            const data = await res.json()
            if (res.ok) {
                setRoles(data.roles || [])
            }
        } catch (error) {
            console.error('Error fetching roles:', error)
        }
    }

    const handleSaveDepartment = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSave({
                ...formData,
                allowedFeatures: JSON.stringify(formData.allowedFeatures),
            })
            onClose()
        } catch (error) {
            console.error('Error saving department:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const roleData = {
                name: roleFormData.name,
                code: roleFormData.code,
                description: roleFormData.description,
                allowedFeatures: roleFormData.allowedFeatures.length > 0
                    ? roleFormData.allowedFeatures
                    : formData.allowedFeatures, // Inherit from department if empty
                isActive: roleFormData.isActive
            }

            if (editingRole) {
                await onUpdateRole(editingRole.id, roleData)
            } else {
                await onCreateRole(roleData)
            }

            setShowRoleModal(false)
            setEditingRole(null)
            setRoleFormData({
                name: '',
                code: '',
                description: '',
                allowedFeatures: [],
                isActive: true,
            })
            fetchRoles()
        } catch (error) {
            console.error('Error saving role:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleEditRole = (role: Role) => {
        setEditingRole(role)
        let features: string[] = []
        try {
            features = role.allowedFeatures ? JSON.parse(role.allowedFeatures) : []
        } catch (e) {
            features = []
        }

        setRoleFormData({
            name: role.name,
            code: role.code,
            description: role.description || '',
            allowedFeatures: features,
            isActive: role.isActive,
        })
        setShowRoleModal(true)
    }

    const toggleFeature = (feature: string, isRole = false) => {
        if (isRole) {
            setRoleFormData(prev => ({
                ...prev,
                allowedFeatures: prev.allowedFeatures.includes(feature)
                    ? prev.allowedFeatures.filter(f => f !== feature)
                    : [...prev.allowedFeatures, feature]
            }))
        } else {
            setFormData(prev => ({
                ...prev,
                allowedFeatures: prev.allowedFeatures.includes(feature)
                    ? prev.allowedFeatures.filter(f => f !== feature)
                    : [...prev.allowedFeatures, feature]
            }))
        }
    }

    const openRoleModal = () => {
        setEditingRole(null)
        setRoleFormData({
            name: '',
            code: '',
            description: '',
            allowedFeatures: [...formData.allowedFeatures], // Start with department features
            isActive: true,
        })
        setShowRoleModal(true)
    }

    const departmentFeatures = formData.allowedFeatures

    return (
        <>
            <Modal
                isOpen={isOpen && !showRoleModal}
                onClose={onClose}
                title={department ? 'Edit Department' : 'Create New Department'}
                description={department ? 'Update department information and manage roles' : 'Add a new department to your organization'}
                size="4xl"
            >
                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        {[
                            { key: 'info', label: 'Department Info', icon: HiOutlineBuildingOffice },
                            { key: 'permissions', label: 'Base Permissions', icon: HiOutlineShieldCheck },
                            { key: 'roles', label: 'Custom Roles', icon: HiOutlineShieldCheck },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                                    activeTab === tab.key
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                                {tab.key === 'roles' && roles.length > 0 && (
                                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium">
                                        {roles.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'info' && (
                        <form onSubmit={handleSaveDepartment} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Department Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="e.g., IT Department, Human Resources"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Brief description of this department..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Job Description
                                </label>
                                <textarea
                                    value={formData.jobDescription}
                                    onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                                    rows={4}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Detailed job description and responsibilities..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Department'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'permissions' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    Department Base Permissions
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    These permissions apply to ALL employees in this department. Custom roles can add or remove permissions from this baseline.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {AVAILABLE_FEATURES.map((feature) => {
                                    const isSelected = formData.allowedFeatures.includes(feature.value)
                                    return (
                                        <button
                                            key={feature.value}
                                            type="button"
                                            onClick={() => toggleFeature(feature.value)}
                                            className={`relative flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                                                isSelected
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {feature.icon}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {feature.label}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'roles' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                        Custom Roles
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Create specific roles with customized permissions for this department
                                    </p>
                                </div>
                                <button
                                    onClick={openRoleModal}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                                >
                                    <HiOutlinePlus className="w-4 h-4" />
                                    Create Role
                                </button>
                            </div>

                            {roles.length === 0 ? (
                                <div className="text-center py-12">
                                    <HiOutlineShieldCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        No Custom Roles Yet
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                                        Create custom roles to provide specific permissions for different job functions within this department.
                                    </p>
                                    <button
                                        onClick={openRoleModal}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                                    >
                                        <HiOutlinePlus className="w-4 h-4" />
                                        Create First Role
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {roles.map((role) => (
                                        <RoleCard
                                            key={role.id}
                                            role={role}
                                            departmentFeatures={departmentFeatures}
                                            onEdit={handleEditRole}
                                            onDelete={onDeleteRole}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Role Modal */}
            <Modal
                isOpen={showRoleModal}
                onClose={() => {
                    setShowRoleModal(false)
                    setEditingRole(null)
                }}
                title={editingRole ? 'Edit Role' : 'Create New Role'}
                description={editingRole ? 'Update role permissions and settings' : 'Create a custom role for this department'}
                size="2xl"
            >
                <form onSubmit={handleSaveRole} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Role Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={roleFormData.name}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="e.g., Field Technician"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Role Code
                            </label>
                            <input
                                type="text"
                                value={roleFormData.code}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                                placeholder="AUTO-GENERATED"
                                disabled={!!editingRole}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
                        <textarea
                            value={roleFormData.description}
                            onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Describe this role..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Role Permissions
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Select features this role can access. Empty selection inherits all department permissions.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_FEATURES.map((feature) => (
                                <label
                                    key={feature.value}
                                    className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={roleFormData.allowedFeatures.includes(feature.value)}
                                        onChange={() => toggleFeature(feature.value, true)}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {feature.icon}
                                        </span>
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {feature.label}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => setShowRoleModal(false)}
                            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : (editingRole ? 'Update Role' : 'Create Role')}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    )
}