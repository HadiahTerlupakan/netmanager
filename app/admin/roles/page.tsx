'use client'

import { useState, useEffect } from 'react'
import RoleForm from '@/components/roles/RoleForm'
import RoleList from '@/components/roles/RoleList'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import Link from 'next/link'

interface Role {
  id: string
  name: string
  code: string
  description?: string | null
  permissions: string[]
  priority: number
  isActive: boolean
  assignedUsers: number
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch roles
  const fetchRoles = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/roles?includeInactive=true')
      if (!response.ok) {
        throw new Error('Failed to fetch roles')
      }

      const data = await response.json()
      setRoles(data.roles || [])
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Save role (create or update)
  const handleSaveRole = async (roleData: any) => {
    setIsSaving(true)
    setError(null)

    try {
      const url = selectedRole
        ? `/api/roles/${selectedRole.id}`
        : '/api/roles'
      const method = selectedRole ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save role')
      }

      // Reset form and refresh list
      setSelectedRole(null)
      await fetchRoles()
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving')
      throw err // Re-throw to let form handle it
    } finally {
      setIsSaving(false)
    }
  }

  // Edit role
  const handleEditRole = (role: Role) => {
    setSelectedRole(role)
    setError(null)
  }

  // Delete role
  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete role')
      }

      // Refresh list
      await fetchRoles()

      // Clear form if editing the deleted role
      if (selectedRole?.id === role.id) {
        setSelectedRole(null)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting')
      alert(err.message || 'Failed to delete role')
    } finally {
      setIsLoading(false)
    }
  }

  // Create new role
  const handleCreateNew = () => {
    setSelectedRole(null)
    setError(null)
  }

  // Cancel editing
  const handleCancel = () => {
    setSelectedRole(null)
    setError(null)
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <HiOutlineArrowLeft className="w-5 h-5" />
                Back to Admin
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Role Management
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-4 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 2 Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Role Form */}
          <div className="lg:sticky lg:top-6 h-fit">
            <RoleForm
              initialData={selectedRole || undefined}
              onSave={handleSaveRole}
              onCancel={handleCancel}
              isLoading={isSaving}
            />
          </div>

          {/* Right Panel - Role List */}
          <div>
            <RoleList
              roles={roles}
              onEdit={handleEditRole}
              onDelete={handleDeleteRole}
              onCreateNew={handleCreateNew}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            How to Use Role Management
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Create roles with specific menu permissions using checkboxes</li>
            <li>• Assign roles to users when creating or editing user accounts</li>
            <li>• Higher priority numbers give more system access</li>
            <li>• Users can only access menus that their role permits</li>
            <li>• Inactive roles cannot be assigned to new users</li>
          </ul>
        </div>
      </div>
    </div>
  )
}