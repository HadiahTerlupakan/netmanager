'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import RoleCard from './RoleCard'
import {
    HiOutlineBuildingOffice,
    HiOutlineShieldCheck,
    HiOutlinePlus,
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
    { value: 'DASHBOARD', label: 'Dashboard', icon: <FiBarChart className="w-4 h-4" />, category: 'Core' },
    { value: 'ROLES', label: 'Roles', icon: <FiShield className="w-4 h-4" />, category: 'Core' },
    { value: 'NETWORK', label: 'Network', icon: <FiGlobe className="w-4 h-4" />, category: 'Operasional' },
    { value: 'FTTH', label: 'FTTH', icon: <FiWifi className="w-4 h-4" />, category: 'Operasional' },
    { value: 'PAKET', label: 'Paket', icon: <FiShoppingCart className="w-4 h-4" />, category: 'Operasional' },
    { value: 'PELANGGAN', label: 'Pelanggan', icon: <FiUsers className="w-4 h-4" />, category: 'Operasional' },
    { value: 'INVENTORY', label: 'Inventory', icon: <FiBox className="w-4 h-4" />, category: 'Operasional' },
    { value: 'USERS', label: 'Users', icon: <FiUser className="w-4 h-4" />, category: 'Admin' },
    { value: 'HELPDESK', label: 'Helpdesk', icon: <FiHelpCircle className="w-4 h-4" />, category: 'Support' },
    { value: 'WORKORDERS', label: 'Work Orders', icon: <FiTool className="w-4 h-4" />, category: 'Support' },
    { value: 'HRIS', label: 'HRIS', icon: <FiUserGroup className="w-4 h-4" />, category: 'Admin' },
    { value: 'FINANCE', label: 'Finance', icon: <FiDollarSign className="w-4 h-4" />, category: 'Admin' },
    { value: 'PENGATURAN', label: 'Pengaturan', icon: <FiSettings className="w-4 h-4" />, category: 'Core' }
]

const FEATURE_CATEGORIES = ['Core', 'Operasional', 'Admin', 'Support']

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
            // When creating a new department, don't include allowedFeatures
            // When editing, include all fields including permissions
            const saveData = department
                ? {
                    ...formData,
                    allowedFeatures: JSON.stringify(formData.allowedFeatures),
                }
                : {
                    name: formData.name,
                    description: formData.description,
                    jobDescription: formData.jobDescription,
                }

            await onSave(saveData)
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

    const toggleAllFeatures = (isRole = false) => {
        if (isRole) {
            const allSelected = roleFormData.allowedFeatures.length === AVAILABLE_FEATURES.length
            setRoleFormData(prev => ({
                ...prev,
                allowedFeatures: allSelected ? [] : AVAILABLE_FEATURES.map(f => f.value)
            }))
        } else {
            const allSelected = formData.allowedFeatures.length === AVAILABLE_FEATURES.length
            setFormData(prev => ({
                ...prev,
                allowedFeatures: allSelected ? [] : AVAILABLE_FEATURES.map(f => f.value)
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

    const tabs = [
        { key: 'info', label: 'Info', icon: HiOutlineBuildingOffice },
        { key: 'permissions', label: 'Permissions', icon: HiOutlineShieldCheck },
        { key: 'roles', label: 'Roles', icon: HiOutlineShieldCheck, count: roles.length },
    ]

    return (
        <>
            <Modal
                isOpen={isOpen && !showRoleModal}
                onClose={onClose}
                title={department ? `Edit: ${department.name}` : 'Department Baru'}
                description={department ? 'Update informasi dan kelola roles' : 'Tambah department baru ke organisasi'}
                size="4xl"
            >
                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 px-6">
                    <nav className="flex gap-1" aria-label="Tabs">
                        {(department ? tabs : [tabs[0]]).map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`relative py-3 px-4 text-sm font-medium rounded-t-lg transition-all ${activeTab === tab.key
                                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs font-medium">
                                            {tab.count}
                                        </span>
                                    )}
                                </span>
                                {activeTab === tab.key && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"></span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'info' && (
                        <form onSubmit={handleSaveDepartment} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Nama Department <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    placeholder="IT Department, Human Resources, dll."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Deskripsi
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                                    placeholder="Deskripsi singkat tentang department..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Job Description
                                </label>
                                <textarea
                                    value={formData.jobDescription}
                                    onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                                    placeholder="Detail tugas dan tanggung jawab..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'permissions' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                        Base Permissions
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        Akses fitur untuk semua karyawan di department ini
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggleAllFeatures(false)}
                                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    {formData.allowedFeatures.length === AVAILABLE_FEATURES.length ? 'Hapus Semua' : 'Pilih Semua'}
                                </button>
                            </div>

                            {/* Features by Category */}
                            <div className="space-y-6">
                                {FEATURE_CATEGORIES.map(category => {
                                    const categoryFeatures = AVAILABLE_FEATURES.filter(f => f.category === category)
                                    return (
                                        <div key={category}>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                                {category}
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {categoryFeatures.map((feature) => {
                                                    const isSelected = formData.allowedFeatures.includes(feature.value)
                                                    return (
                                                        <button
                                                            key={feature.value}
                                                            type="button"
                                                            onClick={() => toggleFeature(feature.value)}
                                                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${isSelected
                                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                                                                }`}
                                                        >
                                                            <span className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}>
                                                                {feature.icon}
                                                            </span>
                                                            <span className="text-sm font-medium">{feature.label}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {formData.allowedFeatures.length} dari {AVAILABLE_FEATURES.length} fitur dipilih
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSaveDepartment}
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50"
                                >
                                    {loading ? 'Menyimpan...' : 'Simpan Permissions'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'roles' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                        Custom Roles
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        Buat role khusus dengan permission berbeda
                                    </p>
                                </div>
                                <button
                                    onClick={openRoleModal}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
                                >
                                    <HiOutlinePlus className="w-4 h-4" />
                                    Tambah Role
                                </button>
                            </div>

                            {roles.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/30 rounded-xl">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                                        <HiOutlineShieldCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                                        Belum Ada Custom Role
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                                        Buat role khusus untuk memberikan permission yang berbeda dari base department
                                    </p>
                                    <button
                                        onClick={openRoleModal}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                                    >
                                        <HiOutlinePlus className="w-4 h-4" />
                                        Buat Role Pertama
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
                title={editingRole ? `Edit: ${editingRole.name}` : 'Role Baru'}
                description={editingRole ? 'Update permissions dan pengaturan role' : 'Buat role khusus untuk department ini'}
                size="2xl"
            >
                <form onSubmit={handleSaveRole} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Nama Role <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={roleFormData.name}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="Field Technician, dll."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Kode Role
                            </label>
                            <input
                                type="text"
                                value={roleFormData.code}
                                onChange={(e) => setRoleFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="AUTO"
                                disabled={!!editingRole}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Deskripsi
                        </label>
                        <textarea
                            value={roleFormData.description}
                            onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={2}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                            placeholder="Deskripsi role..."
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Role Permissions
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Kosongkan untuk mewarisi semua permission department
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleAllFeatures(true)}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {roleFormData.allowedFeatures.length === AVAILABLE_FEATURES.length ? 'Hapus Semua' : 'Pilih Semua'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                            {AVAILABLE_FEATURES.map((feature) => {
                                const isSelected = roleFormData.allowedFeatures.includes(feature.value)
                                return (
                                    <button
                                        key={feature.value}
                                        type="button"
                                        onClick={() => toggleFeature(feature.value, true)}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${isSelected
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        <span className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : ''}>
                                            {feature.icon}
                                        </span>
                                        <span className="text-sm">{feature.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => setShowRoleModal(false)}
                            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50"
                        >
                            {loading ? 'Menyimpan...' : (editingRole ? 'Update Role' : 'Buat Role')}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    )
}