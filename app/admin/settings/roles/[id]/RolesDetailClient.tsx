'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { FiArrowLeft, FiSave, FiEye, FiPlus, FiEdit2, FiTrash2, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { PERMISSION_GROUPS, PERMISSION_GROUPS_MOBILE, ACTIONS } from '@/lib/permission-config'
import { getResourceCapabilities } from '@/lib/resource-capabilities'
import type { ResourceAction } from '@/lib/resource-capabilities'


export function ClientComponent() {
    const router = useRouter()
    const params = useParams()
    const { hasPermission, isLoading: authLoading } = usePermission()

    const isNew = params?.id === 'new'
    const roleId = params?.id as string

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        accessAdminPanel: false,
        accessEmployeePanel: false,
        isRestricted: false,
        isTechnical: false, // New field
        permissions: [] as string[] // Store permission IDs (resource:action)
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin')
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => 
            prev.includes(groupName) 
                ? prev.filter(g => g !== groupName)
                : [...prev, groupName]
        )
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                // If editing, fetch role data
                if (!isNew) {
                    const roleRes = await fetch(`/api/roles/${roleId}`)
                    const roleData = await roleRes.json()

                    if (roleRes.ok) {
                        setFormData({
                            name: roleData.name,
                            description: roleData.description || '',
                            accessAdminPanel: roleData.accessAdminPanel || false,
                            accessEmployeePanel: roleData.accessEmployeePanel || false,
                            isRestricted: roleData.isRestricted || false,
                            isTechnical: roleData.isTechnical || false,
                            // Convert backend permissions (objects) to string format resource:action
                            permissions: roleData.permissions.map((p: any) => `${p.resource}:${p.action}`)
                        })

                        // Calculate expanded groups based on active resources
                        const activeResources = new Set(roleData.permissions.map((p: any) => p.resource))
                        const groupsToExpand: string[] = []

                        // Check Admin Groups
                        Object.entries(PERMISSION_GROUPS).forEach(([groupName, resources]) => {
                            if ((resources as readonly string[]).some(r => activeResources.has(r))) {
                                groupsToExpand.push(`admin-${groupName}`)
                            }
                        })

                        // Check Mobile Groups
                        Object.entries(PERMISSION_GROUPS_MOBILE).forEach(([groupName, resources]) => {
                             if ((resources as readonly string[]).some(r => activeResources.has(r))) {
                                groupsToExpand.push(`employee-${groupName}`)
                            }
                        })

                        setExpandedGroups(groupsToExpand)
                    } else {
                        toast.error(roleData.error || 'Failed to fetch role')
                        router.push('/admin/settings/roles')
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error)
                toast.error('Gagal memuat data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [isNew, roleId, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const url = isNew ? '/api/roles' : `/api/roles/${roleId}`
            const method = isNew ? 'POST' : 'PUT'

            if (isNew && formData.name.toLowerCase() === 'new') {
                toast.error('Nama role tidak boleh "new"')
                setSaving(false)
                return
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Gagal menyimpan role')
            }

            toast.success(isNew ? 'Role berhasil dibuat' : 'Role berhasil diperbarui')
            router.push('/admin/settings/roles')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    if (authLoading || loading) return <div className="p-8 text-center">Loading...</div>

    const requiredPerm = isNew ? 'roles:create' : 'roles:update'
    if (!hasPermission(requiredPerm)) {
        return <div className="p-8 text-center text-red-500">Anda tidak memiliki akses untuk {isNew ? 'membuat' : 'mengedit'} role.</div>
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/admin/settings/roles"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                    <FiArrowLeft className="text-xl dark:text-white" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {isNew ? 'Tambah Role Baru' : `Edit Role: ${formData.name}`}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Informasi Dasar</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Role</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-gray-700 dark:text-white"
                                placeholder="Contoh: Staff Keuangan"
                                disabled={formData.name === 'SUPER_ADMIN'}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-gray-700 dark:text-white"
                                placeholder="Deskripsi singkat role ini"
                            />
                        </div>
                    </div>
                </div>

                {/* Portal Access */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Akses Portal</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.accessAdminPanel}
                                onChange={e => setFormData({ ...formData, accessAdminPanel: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                            />
                            <div>
                                <span className="block font-medium text-gray-800 dark:text-white">Portal Admin</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">Izinkan akses ke dashboard admin dan manajemen sistem ({`/admin`}).</span>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.accessEmployeePanel}
                                onChange={e => setFormData({ ...formData, accessEmployeePanel: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                            />
                            <div>
                                <span className="block font-medium text-gray-800 dark:text-white">Akses Mobile App</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">Izinkan user login ke Mobile App karyawan.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Role Type */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Tipe Role</h2>
                    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={formData.isRestricted}
                            onChange={e => setFormData({ ...formData, isRestricted: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                        />
                        <div>
                            <span className="block font-medium text-gray-800 dark:text-white">Role Terbatas (Restricted)</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Jika aktif, role ini <strong>tidak akan muncul</strong> pada dropdown "Peran Pengguna" di menu Tambah/Edit Pengguna,
                                KECUALI user yang sedang login juga memiliki role ini.
                            </span>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors mt-4">
                        <input
                            type="checkbox"
                            checked={formData.isTechnical}
                            onChange={e => setFormData({ ...formData, isTechnical: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 mt-0.5"
                        />
                        <div>
                            <span className="block font-medium text-gray-800 dark:text-white">Role Teknis (Technical)</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Jika aktif, user dengan role ini akan <strong>dihitung</strong> dalam statistik respon (mis: Helpdesk/Teknisi) 
                                dan mendapat indikator khusus di sistem.
                            </span>
                        </div>
                    </label>
                </div>

                {/* Permission Matrix */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Matrix Hak Akses</h2>
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setActiveTab('admin')}
                                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${activeTab === 'admin'
                                    ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                Portal Admin
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('employee')}
                                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${activeTab === 'employee'
                                    ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                Mobile App
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {(Object.entries(activeTab === 'admin' ? PERMISSION_GROUPS : PERMISSION_GROUPS_MOBILE) as unknown as [string, readonly string[]][]).map(([groupName, resources]) => {
                            const groupActions = resources.flatMap(resource =>
                                ACTIONS.map(action => `${resource}:${action}`)
                            )
                            const selectedGroupActions = groupActions.filter(p => formData.permissions.includes(p))
                            const isGroupChecked = groupActions.every(p => formData.permissions.includes(p))
                            const isGroupIndeterminate = selectedGroupActions.length > 0 && !isGroupChecked
                            
                            const groupKey = `${activeTab}-${groupName}`
                            const isExpanded = expandedGroups.includes(groupKey)

                            const handleGroupToggle = (checked: boolean) => {
                                let newPermissions = [...formData.permissions]
                                if (checked) {
                                    groupActions.forEach(p => {
                                        if (!newPermissions.includes(p)) newPermissions.push(p)
                                    })
                                    // Auto expand when selecting all
                                    if (!expandedGroups.includes(groupKey)) {
                                        setExpandedGroups(prev => [...prev, groupKey])
                                    }
                                } else {
                                    newPermissions = newPermissions.filter(p => !groupActions.includes(p))
                                }
                                setFormData({ ...formData, permissions: newPermissions })
                            }

                            return (
                                <div key={groupName} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-200">
                                    <div 
                                        className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        onClick={() => toggleGroup(groupKey)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isGroupChecked}
                                                    ref={input => {
                                                        if (input) input.indeterminate = isGroupIndeterminate
                                                    }}
                                                    onChange={(e) => handleGroupToggle(e.target.checked)}
                                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                                />
                                            </div>
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-200 capitalize select-none">
                                                {groupName.toLowerCase().replace(/_/g, ' ')}
                                            </h3>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded-full">
                                                {selectedGroupActions.length} / {groupActions.length}
                                            </span>
                                        </div>
                                        <div className="text-gray-500 dark:text-gray-400">
                                            {isExpanded ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 animate-fadeIn">
                                            {resources.map(resource => {
                                                const capabilities = getResourceCapabilities(resource)
                                                const availableActions = ACTIONS.filter(action => capabilities.includes(action as ResourceAction))
                                                
                                                // Group actions
                                                const crudActions = ['read', 'create', 'update', 'delete'].filter(a => availableActions.includes(a as any))
                                                const scopeActions = ['site_only', 'department_only'].filter(a => availableActions.includes(a as any))
                                                const specialActions = availableActions.filter(a => 
                                                    !['read', 'create', 'update', 'delete', 'site_only', 'department_only'].includes(a)
                                                )

                                                // Check "All" status
                                                const resourcePermissionIds = availableActions.map(action => `${resource}:${action}`)
                                                const isAllSelected = resourcePermissionIds.every(id => formData.permissions.includes(id))

                                                const toggleResourceAll = () => {
                                                    let newPermissions = [...formData.permissions]
                                                    if (isAllSelected) {
                                                        newPermissions = newPermissions.filter(id => !resourcePermissionIds.includes(id))
                                                    } else {
                                                        resourcePermissionIds.forEach(id => {
                                                            if (!newPermissions.includes(id)) newPermissions.push(id)
                                                        })
                                                    }
                                                    setFormData({ ...formData, permissions: newPermissions })
                                                }

                                                return (
                                                    <div key={resource} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                                                        {/* Card Header */}
                                                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                                                                {resource.replace(/^k_/, '').replace(/_/g, ' ')}
                                                            </h4>
                                                            <button
                                                                type="button"
                                                                onClick={toggleResourceAll}
                                                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                                                    isAllSelected 
                                                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                                        : 'bg-white border border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                {isAllSelected ? 'Unselect All' : 'Select All'}
                                                            </button>
                                                        </div>

                                                        <div className="p-4 flex-1 flex flex-col gap-4">
                                                            {/* 1. Basic CRUD Zone */}
                                                            {crudActions.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Basic Access</span>
                                                                    <div className="grid grid-cols-4 gap-2">
                                                                        {['read', 'create', 'update', 'delete'].map(action => {
                                                                            const isAvailable = crudActions.includes(action)
                                                                            if (!isAvailable) return <div key={action} className="h-9 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700/50"></div>

                                                                            const permissionId = `${resource}:${action}`
                                                                            const isSelected = formData.permissions.includes(permissionId)
                                                                            
                                                                            // Icons mapping
                                                                            const icons: Record<string, React.ReactNode> = { 
                                                                                'read': <FiEye className="w-4 h-4" />, 
                                                                                'create': <FiPlus className="w-4 h-4" />, 
                                                                                'update': <FiEdit2 className="w-4 h-4" />, 
                                                                                'delete': <FiTrash2 className="w-4 h-4" /> 
                                                                            }
                                                                            const labels: Record<string, string> = { 'read': 'View', 'create': 'Add', 'update': 'Edit', 'delete': 'Del' }

                                                                            return (
                                                                                <button
                                                                                    key={action}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        let newPerms = [...formData.permissions]
                                                                                        if (isSelected) newPerms = newPerms.filter(p => p !== permissionId)
                                                                                        else newPerms.push(permissionId)
                                                                                        setFormData({ ...formData, permissions: newPerms })
                                                                                    }}
                                                                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border transition-all h-full ${
                                                                                        isSelected
                                                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                                                                                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
                                                                                    }`}
                                                                                    title={action}
                                                                                >
                                                                                    <span className="mb-1">{icons[action]}</span>
                                                                                    <span className="text-[10px] font-medium">{labels[action]}</span>
                                                                                </button>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* 2. Special Actions Zone */}
                                                            {specialActions.length > 0 && (
                                                                <div>
                                                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Special Actions</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {specialActions.map(action => {
                                                                            const permissionId = `${resource}:${action}`
                                                                            const isSelected = formData.permissions.includes(permissionId)
                                                                            
                                                                            return (
                                                                                <button
                                                                                    key={action}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        let newPerms = [...formData.permissions]
                                                                                        if (isSelected) newPerms = newPerms.filter(p => p !== permissionId)
                                                                                        else newPerms.push(permissionId)
                                                                                        setFormData({ ...formData, permissions: newPerms })
                                                                                    }}
                                                                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 ${
                                                                                        isSelected
                                                                                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'
                                                                                            : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 hover:border-gray-300'
                                                                                    }`}
                                                                                >
                                                                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-purple-500' : 'bg-gray-300'}`}></span>
                                                                                    {action.replace(/_/g, ' ')}
                                                                                </button>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* 3. Scope Zone */}
                                                            {scopeActions.length > 0 && (
                                                                <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                                                    <div className="space-y-2">
                                                                        {scopeActions.map(action => {
                                                                            const permissionId = `${resource}:${action}`
                                                                            const isSelected = formData.permissions.includes(permissionId)

                                                                            return (
                                                                                <label key={action} className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                                                                                    isSelected 
                                                                                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50' 
                                                                                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                                                                }`}>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${isSelected ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                                                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isSelected ? 'left-4.5' : 'left-0.5'}`} style={{ left: isSelected ? 'calc(100% - 14px)' : '2px' }}></div>
                                                                                        </div>
                                                                                        <span className={`text-xs font-medium ${isSelected ? 'text-amber-800 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                                            Limit to {action.replace('_only', '')}
                                                                                        </span>
                                                                                    </div>
                                                                                    <input 
                                                                                        type="checkbox" 
                                                                                        className="hidden" 
                                                                                        checked={isSelected}
                                                                                        onChange={() => {
                                                                                            let newPerms = [...formData.permissions]
                                                                                            if (isSelected) newPerms = newPerms.filter(p => p !== permissionId)
                                                                                            else newPerms.push(permissionId)
                                                                                            setFormData({ ...formData, permissions: newPerms })
                                                                                        }}
                                                                                    />
                                                                                </label>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                    <Link
                        href="/admin/settings/roles"
                        className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <FiSave />
                        {saving ? 'Menyimpan...' : 'Simpan Role'}
                    </button>
                </div>
            </form>
        </div>
    )
}
