'use client'

import { useState, useEffect } from 'react'
import { useMenuDefinitions, parsePermissionMatrix } from '@/hooks/usePermissions'
import PermissionMatrixEditor from '@/components/roles/PermissionMatrixEditor'
import type { PermissionMatrix } from '@/lib/types/permissions'

interface RoleFormProps {
  initialData?: {
    id: string
    name: string
    description?: string | null
    permissions: string[]  // Legacy format
    allowedFeatures?: string | null  // JSON string from DB
    isActive: boolean
  }
  onSave: (roleData: any) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  portal?: string
}

export default function RoleForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  portal = 'admin'
}: RoleFormProps) {
  const { menus, isLoading: menusLoading } = useMenuDefinitions(portal)

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    isActive: initialData?.isActive ?? true
  })

  // Permission matrix state
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>({})

  // Parse initial permissions
  useEffect(() => {
    if (initialData?.allowedFeatures) {
      // New format - parse from JSON string
      setPermissionMatrix(parsePermissionMatrix(initialData.allowedFeatures))
    } else if (initialData?.permissions && initialData.permissions.length > 0) {
      // Legacy format - convert array to matrix
      const matrix: PermissionMatrix = {}
      initialData.permissions.forEach((p: string) => {
        matrix[p] = { read: true, create: true, update: true, delete: true }
      })
      setPermissionMatrix(matrix)
    } else {
      setPermissionMatrix({})
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Role name is required')
      return
    }

    // Check if at least one permission is selected
    const hasAnyPermission = Object.keys(permissionMatrix).length > 0
    if (!hasAnyPermission) {
      alert('Please select at least one permission')
      return
    }

    // Send with new permission matrix format
    await onSave({
      ...formData,
      permissionMatrix,  // New format
      permissions: Object.keys(permissionMatrix),  // Legacy compatibility
    })
  }

  // Count selected permissions
  const selectedCount = Object.keys(permissionMatrix).length
  const totalMenus = menus.length + menus.reduce((acc, m) => acc + (m.children?.length || 0), 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {initialData ? 'Edit Role' : 'Create New Role'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {initialData ? 'Update role information and permissions' : 'Configure role permissions with granular CRUD control'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g. Finance Staff, IT Manager"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              rows={2}
              placeholder="Brief description of this role's responsibilities"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Status */}
        {initialData && (
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Active
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Inactive roles cannot be assigned to users
            </p>
          </div>
        )}

        {/* Permission Matrix */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Permissions *
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCount} menu dipilih
            </span>
          </div>

          {menusLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
              Loading menus...
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <PermissionMatrixEditor
                menus={menus}
                value={permissionMatrix}
                onChange={setPermissionMatrix}
                portal={portal}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Tips:</strong> Centang permission yang diinginkan untuk setiap menu.
              <br />
              • <span className="text-green-600">Baca</span> = Melihat data
              • <span className="text-blue-600">Buat</span> = Menambah data baru
              • <span className="text-orange-600">Edit</span> = Mengubah data
              • <span className="text-red-600">Hapus</span> = Menghapus data
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isLoading || menusLoading}
            className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : (initialData ? 'Update Role' : 'Create Role')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}